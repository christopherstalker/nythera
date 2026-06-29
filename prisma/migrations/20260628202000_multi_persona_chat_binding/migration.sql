ALTER TABLE "UserPersona"
ADD COLUMN IF NOT EXISTS "label" TEXT,
ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "UserPersona_userId_key";

UPDATE "UserPersona" AS persona
SET
  "label" = COALESCE(
    NULLIF(persona."metadata" #>> ARRAY['profiles', COALESCE(persona."metadata"->>'activeProfileId', '0'), 'label'], ''),
    NULLIF(persona."metadata"->>'label', ''),
    persona."displayName"
  ),
  "isDefault" = true;

INSERT INTO "UserPersona" (
  "id",
  "userId",
  "label",
  "displayName",
  "avatarUrl",
  "summary",
  "background",
  "traits",
  "likes",
  "dislikes",
  "boundaries",
  "isDefault",
  "visibility",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('migrated_', md5(random()::text || clock_timestamp()::text || source."id" || profile.ordinality::text)),
  source."userId",
  COALESCE(NULLIF(profile.item->>'label', ''), NULLIF(profile.item->>'displayName', ''), source."displayName"),
  COALESCE(NULLIF(profile.item->>'displayName', ''), source."displayName"),
  NULLIF(profile.item->>'avatarUrl', ''),
  COALESCE(NULLIF(profile.item->>'summary', ''), source."summary"),
  NULLIF(profile.item->>'background', ''),
  COALESCE(profile_arrays."traits", ARRAY[]::TEXT[]),
  COALESCE(profile_arrays."likes", ARRAY[]::TEXT[]),
  COALESCE(profile_arrays."dislikes", ARRAY[]::TEXT[]),
  COALESCE(profile_arrays."boundaries", ARRAY[]::TEXT[]),
  false,
  CASE
    WHEN profile.item->>'visibility' IN ('PRIVATE', 'PUBLIC', 'UNLISTED') THEN (profile.item->>'visibility')::"Visibility"
    ELSE source."visibility"
  END,
  NULL,
  source."createdAt",
  source."updatedAt"
FROM "UserPersona" AS source
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source."metadata"->'profiles', '[]'::jsonb)) WITH ORDINALITY AS profile(item, ordinality)
CROSS JOIN LATERAL (
  SELECT
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(profile.item->'traits', '[]'::jsonb))) AS "traits",
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(profile.item->'likes', '[]'::jsonb))) AS "likes",
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(profile.item->'dislikes', '[]'::jsonb))) AS "dislikes",
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(profile.item->'boundaries', '[]'::jsonb))) AS "boundaries"
) AS profile_arrays
WHERE COALESCE(profile.item->>'id', '') <> COALESCE(source."metadata"->>'activeProfileId', '');

ALTER TABLE "Chat"
ADD COLUMN IF NOT EXISTS "personaId" TEXT;

UPDATE "Chat" AS chat
SET "personaId" = persona."id"
FROM "UserPersona" AS persona
WHERE chat."userId" = persona."userId"
  AND persona."isDefault" = true
  AND chat."personaId" IS NULL;

CREATE INDEX IF NOT EXISTS "UserPersona_userId_idx" ON "UserPersona"("userId");
CREATE INDEX IF NOT EXISTS "UserPersona_userId_isDefault_idx" ON "UserPersona"("userId", "isDefault");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPersona_one_default_per_user_idx" ON "UserPersona"("userId") WHERE "isDefault" = true;
CREATE INDEX IF NOT EXISTS "Chat_personaId_idx" ON "Chat"("personaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Chat_personaId_fkey'
  ) THEN
    ALTER TABLE "Chat"
      ADD CONSTRAINT "Chat_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "UserPersona"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
