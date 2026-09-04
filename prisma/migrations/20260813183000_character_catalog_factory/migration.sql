CREATE TYPE "CharacterOriginType" AS ENUM (
  'ORIGINAL',
  'PUBLIC_DOMAIN',
  'LICENSED',
  'FAN_INTERPRETATION',
  'REAL_PERSON',
  'HISTORICAL_FIGURE'
);

ALTER TABLE "Character"
  ADD COLUMN "originType" "CharacterOriginType" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "sourceLabel" VARCHAR(240),
  ADD COLUMN "sourceUrl" VARCHAR(1000),
  ADD COLUMN "isRealPerson" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiDisclosure" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contentBatchId" VARCHAR(80),
  ADD COLUMN "qualityReport" JSONB;

CREATE INDEX "character_content_batch_created_idx"
  ON "Character"("contentBatchId", "createdAt" DESC);
