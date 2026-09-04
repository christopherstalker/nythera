ALTER TABLE "User" ADD COLUMN "defaultResponsePrompt" TEXT;
ALTER TABLE "Chat" ADD COLUMN "summaryThroughSequence" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" AS target
SET "defaultResponsePrompt" = latest."responsePrompt"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "responsePrompt"
  FROM "Chat"
  WHERE "responsePrompt" IS NOT NULL AND btrim("responsePrompt") <> ''
  ORDER BY "userId", "lastActiveAt" DESC, "updatedAt" DESC
) AS latest
WHERE target.id = latest."userId" AND target."defaultResponsePrompt" IS NULL;
