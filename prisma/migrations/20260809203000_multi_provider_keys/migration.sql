DROP INDEX "UserApiKey_userId_provider_key";

ALTER TABLE "UserApiKey"
ADD COLUMN "providerPriority" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "UserApiKey_userId_provider_providerPriority_idx"
ON "UserApiKey"("userId", "provider", "providerPriority");
