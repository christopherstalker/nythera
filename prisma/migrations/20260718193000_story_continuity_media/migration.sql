-- CreateEnum
CREATE TYPE "StoryVisualKind" AS ENUM ('PORTRAIT', 'OUTFIT', 'LOCATION', 'ITEM', 'MOODBOARD', 'OTHER');
CREATE TYPE "StoryCheckpointKind" AS ENUM ('MANUAL', 'AUTO', 'BOOKMARK');

-- CreateTable
CREATE TABLE "StoryParticipantState" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "displayNameOverride" TEXT,
    "pronouns" TEXT,
    "currentMood" TEXT,
    "appearance" TEXT,
    "currentGoal" TEXT,
    "innerConflict" TEXT,
    "voiceStyle" TEXT,
    "speakingStyle" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoryParticipantState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryVoiceBinding" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "style" TEXT,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "pitch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoPlay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoryVoiceBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryVisualReference" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT,
    "participantId" TEXT,
    "entityId" TEXT,
    "kind" "StoryVisualKind" NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "prompt" TEXT,
    "notes" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoryVisualReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryCheckpoint" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sourceTurnId" TEXT,
    "kind" "StoryCheckpointKind" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "openThreads" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantFactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "relationshipSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryParticipantState_storyId_updatedAt_idx" ON "StoryParticipantState"("storyId", "updatedAt" DESC);
CREATE INDEX "StoryParticipantState_participantId_idx" ON "StoryParticipantState"("participantId");
CREATE UNIQUE INDEX "StoryParticipantState_timelineId_participantId_key" ON "StoryParticipantState"("timelineId", "participantId");
CREATE INDEX "StoryVoiceBinding_participantId_idx" ON "StoryVoiceBinding"("participantId");
CREATE INDEX "StoryVoiceBinding_storyId_provider_idx" ON "StoryVoiceBinding"("storyId", "provider");
CREATE UNIQUE INDEX "StoryVoiceBinding_storyId_participantId_key" ON "StoryVoiceBinding"("storyId", "participantId");
CREATE INDEX "StoryVisualReference_storyId_kind_locked_idx" ON "StoryVisualReference"("storyId", "kind", "locked");
CREATE INDEX "StoryVisualReference_timelineId_idx" ON "StoryVisualReference"("timelineId");
CREATE INDEX "StoryVisualReference_participantId_idx" ON "StoryVisualReference"("participantId");
CREATE INDEX "StoryVisualReference_entityId_idx" ON "StoryVisualReference"("entityId");
CREATE INDEX "StoryCheckpoint_storyId_createdAt_idx" ON "StoryCheckpoint"("storyId", "createdAt" DESC);
CREATE INDEX "StoryCheckpoint_timelineId_createdAt_idx" ON "StoryCheckpoint"("timelineId", "createdAt" DESC);
CREATE INDEX "StoryCheckpoint_sourceTurnId_idx" ON "StoryCheckpoint"("sourceTurnId");

-- AddForeignKey
ALTER TABLE "StoryParticipantState" ADD CONSTRAINT "StoryParticipantState_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryParticipantState" ADD CONSTRAINT "StoryParticipantState_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryParticipantState" ADD CONSTRAINT "StoryParticipantState_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "StoryParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryVoiceBinding" ADD CONSTRAINT "StoryVoiceBinding_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryVoiceBinding" ADD CONSTRAINT "StoryVoiceBinding_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "StoryParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryVisualReference" ADD CONSTRAINT "StoryVisualReference_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryVisualReference" ADD CONSTRAINT "StoryVisualReference_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryVisualReference" ADD CONSTRAINT "StoryVisualReference_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "StoryParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryVisualReference" ADD CONSTRAINT "StoryVisualReference_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "StoryEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryCheckpoint" ADD CONSTRAINT "StoryCheckpoint_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryCheckpoint" ADD CONSTRAINT "StoryCheckpoint_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryCheckpoint" ADD CONSTRAINT "StoryCheckpoint_sourceTurnId_fkey" FOREIGN KEY ("sourceTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
