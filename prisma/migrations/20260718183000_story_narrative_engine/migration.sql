-- CreateEnum
CREATE TYPE "StoryPacing" AS ENUM ('SLOW', 'BALANCED', 'FAST');

-- CreateEnum
CREATE TYPE "StoryInitiative" AS ENUM ('REACTIVE', 'BALANCED', 'PROACTIVE');

-- CreateEnum
CREATE TYPE "StoryArcStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "StoryBeatStatus" AS ENUM ('PLANNED', 'READY', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "StoryHookStatus" AS ENUM ('OPEN', 'ESCALATED', 'RESOLVED', 'DROPPED');

-- CreateEnum
CREATE TYPE "StoryProactiveStatus" AS ENUM ('SCHEDULED', 'READY', 'FIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StoryDirectorProfile" (
    "storyId" TEXT NOT NULL,
    "tone" TEXT,
    "pacing" "StoryPacing" NOT NULL DEFAULT 'BALANCED',
    "initiative" "StoryInitiative" NOT NULL DEFAULT 'BALANCED',
    "conflictLevel" INTEGER NOT NULL DEFAULT 5,
    "romanceLevel" INTEGER NOT NULL DEFAULT 3,
    "mysteryLevel" INTEGER NOT NULL DEFAULT 5,
    "humorLevel" INTEGER NOT NULL DEFAULT 3,
    "allowOffscreenEvents" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryDirectorProfile_pkey" PRIMARY KEY ("storyId")
);

-- CreateTable
CREATE TABLE "StoryArc" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT,
    "title" TEXT NOT NULL,
    "premise" TEXT NOT NULL,
    "status" "StoryArcStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "targetBeatCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryArc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryBeat" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "arcId" TEXT,
    "resolvedByTurnId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "StoryBeatStatus" NOT NULL DEFAULT 'PLANNED',
    "position" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "trigger" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryBeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryHook" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "arcId" TEXT,
    "openedByTurnId" TEXT,
    "resolvedByTurnId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payoff" TEXT,
    "status" "StoryHookStatus" NOT NULL DEFAULT 'OPEN',
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "directorOnly" BOOLEAN NOT NULL DEFAULT false,
    "dueSequence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StoryHook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryRelationshipState" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "label" TEXT,
    "trust" INTEGER NOT NULL DEFAULT 0,
    "affection" INTEGER NOT NULL DEFAULT 0,
    "tension" INTEGER NOT NULL DEFAULT 0,
    "respect" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryRelationshipState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryProactiveEvent" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "actorParticipantId" TEXT,
    "createdByTurnId" TEXT,
    "firedAtTurnId" TEXT,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "status" "StoryProactiveStatus" NOT NULL DEFAULT 'SCHEDULED',
    "channel" "StoryTurnChannel" NOT NULL DEFAULT 'ACTION',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dueSequence" INTEGER,
    "triggerAt" TIMESTAMP(3),
    "metadata" JSONB,
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProactiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryArc_storyId_status_priority_idx" ON "StoryArc"("storyId", "status", "priority" DESC);
CREATE INDEX "StoryArc_timelineId_idx" ON "StoryArc"("timelineId");
CREATE INDEX "StoryBeat_storyId_status_priority_idx" ON "StoryBeat"("storyId", "status", "priority" DESC);
CREATE INDEX "StoryBeat_timelineId_status_position_idx" ON "StoryBeat"("timelineId", "status", "position");
CREATE INDEX "StoryBeat_arcId_idx" ON "StoryBeat"("arcId");
CREATE INDEX "StoryBeat_resolvedByTurnId_idx" ON "StoryBeat"("resolvedByTurnId");
CREATE INDEX "StoryHook_storyId_status_urgency_idx" ON "StoryHook"("storyId", "status", "urgency" DESC);
CREATE INDEX "StoryHook_timelineId_status_dueSequence_idx" ON "StoryHook"("timelineId", "status", "dueSequence");
CREATE INDEX "StoryHook_arcId_idx" ON "StoryHook"("arcId");
CREATE INDEX "StoryHook_openedByTurnId_idx" ON "StoryHook"("openedByTurnId");
CREATE INDEX "StoryHook_resolvedByTurnId_idx" ON "StoryHook"("resolvedByTurnId");
CREATE INDEX "StoryRelationshipState_storyId_updatedAt_idx" ON "StoryRelationshipState"("storyId", "updatedAt" DESC);
CREATE INDEX "StoryRelationshipState_fromParticipantId_idx" ON "StoryRelationshipState"("fromParticipantId");
CREATE INDEX "StoryRelationshipState_toParticipantId_idx" ON "StoryRelationshipState"("toParticipantId");
CREATE UNIQUE INDEX "StoryRelationshipState_timelineId_fromParticipantId_toParti_key" ON "StoryRelationshipState"("timelineId", "fromParticipantId", "toParticipantId");
CREATE INDEX "StoryProactiveEvent_storyId_status_priority_idx" ON "StoryProactiveEvent"("storyId", "status", "priority" DESC);
CREATE INDEX "StoryProactiveEvent_timelineId_status_dueSequence_idx" ON "StoryProactiveEvent"("timelineId", "status", "dueSequence");
CREATE INDEX "StoryProactiveEvent_actorParticipantId_idx" ON "StoryProactiveEvent"("actorParticipantId");
CREATE INDEX "StoryProactiveEvent_createdByTurnId_idx" ON "StoryProactiveEvent"("createdByTurnId");
CREATE INDEX "StoryProactiveEvent_firedAtTurnId_idx" ON "StoryProactiveEvent"("firedAtTurnId");

-- AddForeignKey
ALTER TABLE "StoryDirectorProfile" ADD CONSTRAINT "StoryDirectorProfile_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryArc" ADD CONSTRAINT "StoryArc_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryArc" ADD CONSTRAINT "StoryArc_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryBeat" ADD CONSTRAINT "StoryBeat_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryBeat" ADD CONSTRAINT "StoryBeat_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryBeat" ADD CONSTRAINT "StoryBeat_arcId_fkey" FOREIGN KEY ("arcId") REFERENCES "StoryArc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryBeat" ADD CONSTRAINT "StoryBeat_resolvedByTurnId_fkey" FOREIGN KEY ("resolvedByTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryHook" ADD CONSTRAINT "StoryHook_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryHook" ADD CONSTRAINT "StoryHook_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryHook" ADD CONSTRAINT "StoryHook_arcId_fkey" FOREIGN KEY ("arcId") REFERENCES "StoryArc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryHook" ADD CONSTRAINT "StoryHook_openedByTurnId_fkey" FOREIGN KEY ("openedByTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryHook" ADD CONSTRAINT "StoryHook_resolvedByTurnId_fkey" FOREIGN KEY ("resolvedByTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryRelationshipState" ADD CONSTRAINT "StoryRelationshipState_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryRelationshipState" ADD CONSTRAINT "StoryRelationshipState_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryRelationshipState" ADD CONSTRAINT "StoryRelationshipState_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "StoryParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryRelationshipState" ADD CONSTRAINT "StoryRelationshipState_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "StoryParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryProactiveEvent" ADD CONSTRAINT "StoryProactiveEvent_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryProactiveEvent" ADD CONSTRAINT "StoryProactiveEvent_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryProactiveEvent" ADD CONSTRAINT "StoryProactiveEvent_actorParticipantId_fkey" FOREIGN KEY ("actorParticipantId") REFERENCES "StoryParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryProactiveEvent" ADD CONSTRAINT "StoryProactiveEvent_createdByTurnId_fkey" FOREIGN KEY ("createdByTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryProactiveEvent" ADD CONSTRAINT "StoryProactiveEvent_firedAtTurnId_fkey" FOREIGN KEY ("firedAtTurnId") REFERENCES "StoryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
