ALTER TABLE "UserApiKey"
ALTER COLUMN "fallbackEnabled" SET DEFAULT false;

UPDATE "UserApiKey"
SET "fallbackEnabled" = false
WHERE "fallbackPriority" IS NULL;
