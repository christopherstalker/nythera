ALTER TABLE "UserApiKey"
ADD COLUMN "credentialStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "validatedAt" TIMESTAMP(3);

CREATE INDEX "UserApiKey_userId_credentialStatus_idx"
ON "UserApiKey"("userId", "credentialStatus");
