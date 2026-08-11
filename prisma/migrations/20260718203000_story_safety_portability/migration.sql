ALTER TABLE "ChatShare" ADD COLUMN "storySnapshot" JSONB;

CREATE TYPE "StoryContentRating" AS ENUM ('GENERAL', 'TEEN', 'MATURE');

CREATE TABLE "StorySafetyProfile" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "contentRating" "StoryContentRating" NOT NULL DEFAULT 'MATURE',
    "hardLimits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "softLimits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fadeToBlack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkInInterval" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySafetyProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorySafetyProfile_storyId_key" ON "StorySafetyProfile"("storyId");
CREATE INDEX "StorySafetyProfile_storyId_paused_idx" ON "StorySafetyProfile"("storyId", "paused");

ALTER TABLE "StorySafetyProfile"
ADD CONSTRAINT "StorySafetyProfile_storyId_fkey"
FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
