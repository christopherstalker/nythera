CREATE TYPE "MemoryStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "RoomMemberRole" AS ENUM ('PLAYER', 'OBSERVER');

ALTER TABLE "Chat" ADD COLUMN "temporaryPersonaId" TEXT;
ALTER TABLE "Chat" ADD COLUMN "translationLanguage" TEXT;
ALTER TABLE "Room" ADD COLUMN "inviteCode" TEXT;
ALTER TABLE "RoomMessage" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "Memory" ADD COLUMN "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "UserPersonaRevision" (
  "id" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPersonaRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterPersonaPreference" (
  "userId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterPersonaPreference_pkey" PRIMARY KEY ("userId", "characterId")
);

CREATE TABLE "ChatMacro" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatMacro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomMember" (
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "RoomMemberRole" NOT NULL DEFAULT 'PLAYER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("roomId", "userId")
);

CREATE TABLE "StoryRelationshipRevision" (
  "id" TEXT NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "trust" INTEGER NOT NULL,
  "affection" INTEGER NOT NULL,
  "tension" INTEGER NOT NULL,
  "respect" INTEGER NOT NULL,
  "label" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryRelationshipRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Room_inviteCode_key" ON "Room"("inviteCode");
CREATE INDEX "Chat_temporaryPersonaId_idx" ON "Chat"("temporaryPersonaId");
CREATE INDEX "RoomMessage_actorUserId_idx" ON "RoomMessage"("actorUserId");
CREATE UNIQUE INDEX "UserPersonaRevision_personaId_version_key" ON "UserPersonaRevision"("personaId", "version");
CREATE INDEX "UserPersonaRevision_personaId_createdAt_idx" ON "UserPersonaRevision"("personaId", "createdAt" DESC);
CREATE INDEX "CharacterPersonaPreference_personaId_idx" ON "CharacterPersonaPreference"("personaId");
CREATE UNIQUE INDEX "ChatMacro_userId_name_key" ON "ChatMacro"("userId", "name");
CREATE INDEX "ChatMacro_userId_updatedAt_idx" ON "ChatMacro"("userId", "updatedAt" DESC);
CREATE INDEX "RoomMember_userId_joinedAt_idx" ON "RoomMember"("userId", "joinedAt" DESC);
CREATE INDEX "StoryRelationshipRevision_relationshipId_createdAt_idx" ON "StoryRelationshipRevision"("relationshipId", "createdAt" DESC);
DROP INDEX "Memory_userId_characterId_importance_idx";
CREATE INDEX "Memory_userId_status_characterId_importance_idx" ON "Memory"("userId", "status", "characterId", "importance");

ALTER TABLE "Chat" ADD CONSTRAINT "Chat_temporaryPersonaId_fkey" FOREIGN KEY ("temporaryPersonaId") REFERENCES "UserPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserPersonaRevision" ADD CONSTRAINT "UserPersonaRevision_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterPersonaPreference" ADD CONSTRAINT "CharacterPersonaPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterPersonaPreference" ADD CONSTRAINT "CharacterPersonaPreference_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterPersonaPreference" ADD CONSTRAINT "CharacterPersonaPreference_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMacro" ADD CONSTRAINT "ChatMacro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryRelationshipRevision" ADD CONSTRAINT "StoryRelationshipRevision_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "StoryRelationshipState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
