ALTER TABLE "User"
ADD COLUMN "lastPersonaId" TEXT;

UPDATE "User" AS account
SET "lastPersonaId" = (
  SELECT "id"
  FROM "UserPersona"
  WHERE "userId" = account."id"
  ORDER BY "isDefault" DESC, "updatedAt" DESC
  LIMIT 1
);
