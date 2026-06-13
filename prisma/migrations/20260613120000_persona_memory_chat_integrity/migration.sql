ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "persona" JSONB;

ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Message_clientRequestId_key"
  ON "Message"("clientRequestId");

CREATE INDEX IF NOT EXISTS "Chat_userId_lastActiveAt_idx"
  ON "Chat"("userId", "lastActiveAt");

ALTER TYPE "MemoryCategory" ADD VALUE IF NOT EXISTS 'FACT';
ALTER TYPE "MemoryCategory" ADD VALUE IF NOT EXISTS 'EMOTIONAL_CONTEXT';
ALTER TYPE "MemoryCategory" ADD VALUE IF NOT EXISTS 'RECURRING_TOPIC';

ALTER TABLE "Memory"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75;

UPDATE "UserApiKey"
SET "defaultModel" = 'gemini-2.5-flash'
WHERE "apiFormat" = 'GEMINI'
  AND "defaultModel" = 'gemini-1.5-flash';

UPDATE "Chat"
SET "model" = 'gemini-2.5-flash'
WHERE "model" = 'gemini-1.5-flash';
