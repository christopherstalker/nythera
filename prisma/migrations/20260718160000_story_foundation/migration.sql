-- CreateEnum
CREATE TYPE "StoryMode" AS ENUM ('SOLO', 'ENSEMBLE', 'SHARED');

-- CreateEnum
CREATE TYPE "StoryParticipantRole" AS ENUM ('OWNER', 'PLAYER', 'CHARACTER', 'NPC', 'OBSERVER');

-- CreateEnum
CREATE TYPE "StoryTurnChannel" AS ENUM ('DIALOGUE', 'ACTION', 'THOUGHT', 'WHISPER', 'OOC', 'SYSTEM');

-- CreateEnum
CREATE TYPE "StoryEntityType" AS ENUM ('CHARACTER', 'PERSONA', 'LOCATION', 'ITEM', 'ORGANIZATION', 'EVENT', 'CONCEPT');

-- CreateEnum
CREATE TYPE "StoryFactScope" AS ENUM ('STORY', 'PARTICIPANT', 'CHARACTER', 'OWNER');

-- CreateEnum
CREATE TYPE "StoryFactStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "StoryKnowledgeState" AS ENUM ('KNOWN', 'SUSPECTED', 'FORGOTTEN');

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "storyId" TEXT,
ADD COLUMN     "timelineId" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "storyId" TEXT,
ADD COLUMN     "timelineId" TEXT;

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "personaId" TEXT,
    "title" TEXT NOT NULL,
    "mode" "StoryMode" NOT NULL DEFAULT 'SOLO',
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryParticipant" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT,
    "characterId" TEXT,
    "personaId" TEXT,
    "role" "StoryParticipantRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "metadata" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryTimeline" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "parentTimelineId" TEXT,
    "forkedFromTurnId" TEXT,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryTurn" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "channel" "StoryTurnChannel" NOT NULL DEFAULT 'DIALOGUE',
    "actorUserId" TEXT,
    "actorCharacterId" TEXT,
    "sourceMessageId" TEXT,
    "sourceRoomMessageId" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryEntity" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "sourceCharacterId" TEXT,
    "sourcePersonaId" TEXT,
    "type" "StoryEntityType" NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryFact" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT,
    "subjectEntityId" TEXT,
    "objectEntityId" TEXT,
    "sourceTurnId" TEXT,
    "sourceMessageId" TEXT,
    "predicate" TEXT NOT NULL,
    "objectText" TEXT NOT NULL,
    "objectData" JSONB,
    "scope" "StoryFactScope" NOT NULL DEFAULT 'STORY',
    "status" "StoryFactStatus" NOT NULL DEFAULT 'ACTIVE',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(1536),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryKnowledge" (
    "factId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "state" "StoryKnowledgeState" NOT NULL DEFAULT 'KNOWN',
    "learnedAtTurnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryKnowledge_pkey" PRIMARY KEY ("factId","participantId")
);

-- CreateTable
CREATE TABLE "StoryStateSnapshot" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sourceTurnId" TEXT,
    "version" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_ownerId_archivedAt_lastActiveAt_idx" ON "Story"("ownerId", "archivedAt", "lastActiveAt" DESC);

-- CreateIndex
CREATE INDEX "Story_personaId_idx" ON "Story"("personaId");

-- CreateIndex
CREATE INDEX "StoryParticipant_storyId_role_idx" ON "StoryParticipant"("storyId", "role");

-- CreateIndex
CREATE INDEX "StoryParticipant_userId_idx" ON "StoryParticipant"("userId");

-- CreateIndex
CREATE INDEX "StoryParticipant_characterId_idx" ON "StoryParticipant"("characterId");

-- CreateIndex
CREATE INDEX "StoryParticipant_personaId_idx" ON "StoryParticipant"("personaId");

-- CreateIndex
CREATE INDEX "StoryTimeline_storyId_isActive_idx" ON "StoryTimeline"("storyId", "isActive");

-- CreateIndex
CREATE INDEX "StoryTimeline_parentTimelineId_idx" ON "StoryTimeline"("parentTimelineId");

-- CreateIndex
CREATE INDEX "StoryTimeline_forkedFromTurnId_idx" ON "StoryTimeline"("forkedFromTurnId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTurn_sourceMessageId_key" ON "StoryTurn"("sourceMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTurn_sourceRoomMessageId_key" ON "StoryTurn"("sourceRoomMessageId");

-- CreateIndex
CREATE INDEX "StoryTurn_storyId_createdAt_idx" ON "StoryTurn"("storyId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryTurn_actorUserId_idx" ON "StoryTurn"("actorUserId");

-- CreateIndex
CREATE INDEX "StoryTurn_actorCharacterId_idx" ON "StoryTurn"("actorCharacterId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTurn_timelineId_sequence_key" ON "StoryTurn"("timelineId", "sequence");

-- CreateIndex
CREATE INDEX "StoryEntity_storyId_type_idx" ON "StoryEntity"("storyId", "type");

-- CreateIndex
CREATE INDEX "StoryEntity_sourceCharacterId_idx" ON "StoryEntity"("sourceCharacterId");

-- CreateIndex
CREATE INDEX "StoryEntity_sourcePersonaId_idx" ON "StoryEntity"("sourcePersonaId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryEntity_storyId_canonicalKey_key" ON "StoryEntity"("storyId", "canonicalKey");

-- CreateIndex
CREATE INDEX "StoryFact_storyId_status_locked_importance_idx" ON "StoryFact"("storyId", "status", "locked", "importance" DESC);

-- CreateIndex
CREATE INDEX "StoryFact_timelineId_idx" ON "StoryFact"("timelineId");

-- CreateIndex
CREATE INDEX "StoryFact_subjectEntityId_predicate_idx" ON "StoryFact"("subjectEntityId", "predicate");

-- CreateIndex
CREATE INDEX "StoryFact_objectEntityId_idx" ON "StoryFact"("objectEntityId");

-- CreateIndex
CREATE INDEX "StoryFact_sourceTurnId_idx" ON "StoryFact"("sourceTurnId");

-- CreateIndex
CREATE INDEX "StoryFact_sourceMessageId_idx" ON "StoryFact"("sourceMessageId");

-- CreateIndex
CREATE INDEX "StoryKnowledge_participantId_state_idx" ON "StoryKnowledge"("participantId", "state");

-- CreateIndex
CREATE INDEX "StoryStateSnapshot_storyId_createdAt_idx" ON "StoryStateSnapshot"("storyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StoryStateSnapshot_sourceTurnId_idx" ON "StoryStateSnapshot"("sourceTurnId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryStateSnapshot_timelineId_version_key" ON "StoryStateSnapshot"("timelineId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_timelineId_key" ON "Chat"("timelineId");

-- CreateIndex
CREATE INDEX "Chat_storyId_idx" ON "Chat"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_timelineId_key" ON "Room"("timelineId");

-- CreateIndex
CREATE INDEX "Room_storyId_idx" ON "Room"("storyId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryParticipant" ADD CONSTRAINT "StoryParticipant_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryParticipant" ADD CONSTRAINT "StoryParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryParticipant" ADD CONSTRAINT "StoryParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryParticipant" ADD CONSTRAINT "StoryParticipant_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTimeline" ADD CONSTRAINT "StoryTimeline_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTimeline" ADD CONSTRAINT "StoryTimeline_parentTimelineId_fkey" FOREIGN KEY ("parentTimelineId") REFERENCES "StoryTimeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTimeline" ADD CONSTRAINT "StoryTimeline_forkedFromTurnId_fkey" FOREIGN KEY ("forkedFromTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTurn" ADD CONSTRAINT "StoryTurn_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTurn" ADD CONSTRAINT "StoryTurn_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTurn" ADD CONSTRAINT "StoryTurn_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTurn" ADD CONSTRAINT "StoryTurn_actorCharacterId_fkey" FOREIGN KEY ("actorCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTurn" ADD CONSTRAINT "StoryTurn_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTurn" ADD CONSTRAINT "StoryTurn_sourceRoomMessageId_fkey" FOREIGN KEY ("sourceRoomMessageId") REFERENCES "RoomMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryEntity" ADD CONSTRAINT "StoryEntity_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryEntity" ADD CONSTRAINT "StoryEntity_sourceCharacterId_fkey" FOREIGN KEY ("sourceCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryEntity" ADD CONSTRAINT "StoryEntity_sourcePersonaId_fkey" FOREIGN KEY ("sourcePersonaId") REFERENCES "UserPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_subjectEntityId_fkey" FOREIGN KEY ("subjectEntityId") REFERENCES "StoryEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_objectEntityId_fkey" FOREIGN KEY ("objectEntityId") REFERENCES "StoryEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_sourceTurnId_fkey" FOREIGN KEY ("sourceTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryKnowledge" ADD CONSTRAINT "StoryKnowledge_factId_fkey" FOREIGN KEY ("factId") REFERENCES "StoryFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryKnowledge" ADD CONSTRAINT "StoryKnowledge_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "StoryParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryStateSnapshot" ADD CONSTRAINT "StoryStateSnapshot_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryStateSnapshot" ADD CONSTRAINT "StoryStateSnapshot_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryStateSnapshot" ADD CONSTRAINT "StoryStateSnapshot_sourceTurnId_fkey" FOREIGN KEY ("sourceTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
