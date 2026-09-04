CREATE TYPE "StoryFactKind" AS ENUM ('PERMANENT', 'STATE', 'EVENT');
CREATE TYPE "StorySceneStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

ALTER TABLE "StoryFact"
ADD COLUMN "kind" "StoryFactKind" NOT NULL DEFAULT 'PERMANENT',
ADD COLUMN "worldTime" TEXT,
ADD COLUMN "validFromSequence" INTEGER,
ADD COLUMN "validUntilSequence" INTEGER;

UPDATE "StoryFact"
SET "kind" = 'STATE'
WHERE lower("predicate") IN ('is true now', 'is not true now');

CREATE TABLE "StoryScene" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "timelineId" TEXT NOT NULL,
  "status" "StorySceneStatus" NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT,
  "worldTime" TEXT,
  "location" TEXT,
  "startedAtSequence" INTEGER NOT NULL DEFAULT 0,
  "endedAtSequence" INTEGER,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryScene_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StoryScene" (
  "id",
  "storyId",
  "timelineId",
  "status",
  "title",
  "worldTime",
  "location",
  "startedAtSequence",
  "createdAt",
  "updatedAt"
)
SELECT
  'scene_' || md5(t."id"),
  t."storyId",
  t."id",
  'ACTIVE',
  'Current scene',
  latest.state->>'time',
  latest.state->>'location',
  COALESCE(turns.sequence, 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "StoryTimeline" t
LEFT JOIN LATERAL (
  SELECT s."state"
  FROM "StoryStateSnapshot" s
  WHERE s."timelineId" = t."id"
  ORDER BY s."version" DESC
  LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
  SELECT MAX(st."sequence") AS sequence
  FROM "StoryTurn" st
  WHERE st."timelineId" = t."id"
) turns ON true;

ALTER TABLE "StoryStateSnapshot" ADD COLUMN "sceneId" TEXT;

UPDATE "StoryStateSnapshot" snapshot
SET "sceneId" = scene."id"
FROM "StoryScene" scene
WHERE scene."timelineId" = snapshot."timelineId" AND scene."status" = 'ACTIVE';

CREATE INDEX "StoryFact_storyId_kind_status_validUntilSequence_idx"
ON "StoryFact"("storyId", "kind", "status", "validUntilSequence");
CREATE INDEX "StoryScene_storyId_status_updatedAt_idx"
ON "StoryScene"("storyId", "status", "updatedAt" DESC);
CREATE INDEX "StoryScene_timelineId_status_startedAtSequence_idx"
ON "StoryScene"("timelineId", "status", "startedAtSequence" DESC);
CREATE UNIQUE INDEX "StoryScene_one_active_per_timeline_idx"
ON "StoryScene"("timelineId") WHERE "status" = 'ACTIVE';
CREATE INDEX "StoryStateSnapshot_sceneId_idx" ON "StoryStateSnapshot"("sceneId");

ALTER TABLE "StoryScene"
ADD CONSTRAINT "StoryScene_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "StoryScene_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "StoryTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryStateSnapshot"
ADD CONSTRAINT "StoryStateSnapshot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
