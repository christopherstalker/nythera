ALTER TABLE "Character"
ADD COLUMN "preferredProvider" TEXT,
ADD COLUMN "preferredModel" TEXT,
ADD COLUMN "temperature" DOUBLE PRECISION,
ADD COLUMN "topP" DOUBLE PRECISION,
ADD COLUMN "frequencyPenalty" DOUBLE PRECISION,
ADD COLUMN "presencePenalty" DOUBLE PRECISION,
ADD COLUMN "maxTokens" INTEGER,
ADD COLUMN "systemPromptOverride" TEXT;

ALTER TABLE "Message"
ADD COLUMN "provider" TEXT,
ADD COLUMN "inputTokens" INTEGER,
ADD COLUMN "outputTokens" INTEGER,
ADD COLUMN "estimatedCost" DECIMAL(12,8),
ADD COLUMN "usageEstimated" BOOLEAN;

ALTER TABLE "UserApiKey"
ADD COLUMN "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "fallbackPriority" INTEGER;

CREATE INDEX "UserApiKey_userId_fallbackEnabled_fallbackPriority_idx"
ON "UserApiKey"("userId", "fallbackEnabled", "fallbackPriority");
