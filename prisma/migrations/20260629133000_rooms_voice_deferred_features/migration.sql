DO $$ BEGIN
  CREATE TYPE "RoomMessageRole" AS ENUM ('USER', 'CHARACTER', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Room" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "personaId" TEXT,
  "title" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "responsePrompt" TEXT,
  "summary" TEXT,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoomCharacter" (
  "roomId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomCharacter_pkey" PRIMARY KEY ("roomId", "characterId")
);

CREATE TABLE IF NOT EXISTS "RoomMessage" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "sequence" INTEGER,
  "role" "RoomMessageRole" NOT NULL,
  "characterId" TEXT,
  "content" TEXT NOT NULL,
  "tokens" INTEGER,
  "model" TEXT,
  "provider" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCost" DECIMAL(12,8),
  "usageEstimated" BOOLEAN,
  "clientRequestId" TEXT,
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VoiceApiKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "authId" TEXT,
  "baseUrl" TEXT,
  "defaultVoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceApiKey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Room_userId_lastActiveAt_idx" ON "Room"("userId", "lastActiveAt");
CREATE INDEX IF NOT EXISTS "Room_personaId_idx" ON "Room"("personaId");
CREATE INDEX IF NOT EXISTS "RoomCharacter_characterId_idx" ON "RoomCharacter"("characterId");
CREATE INDEX IF NOT EXISTS "RoomCharacter_roomId_position_idx" ON "RoomCharacter"("roomId", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "RoomMessage_roomId_sequence_key" ON "RoomMessage"("roomId", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "RoomMessage_clientRequestId_key" ON "RoomMessage"("clientRequestId");
CREATE INDEX IF NOT EXISTS "RoomMessage_roomId_createdAt_sequence_idx" ON "RoomMessage"("roomId", "createdAt", "sequence");
CREATE INDEX IF NOT EXISTS "RoomMessage_characterId_idx" ON "RoomMessage"("characterId");
CREATE UNIQUE INDEX IF NOT EXISTS "VoiceApiKey_userId_provider_key" ON "VoiceApiKey"("userId", "provider");
CREATE INDEX IF NOT EXISTS "VoiceApiKey_userId_idx" ON "VoiceApiKey"("userId");

DO $$ BEGIN
  ALTER TABLE "Room" ADD CONSTRAINT "Room_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Room" ADD CONSTRAINT "Room_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomCharacter" ADD CONSTRAINT "RoomCharacter_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomCharacter" ADD CONSTRAINT "RoomCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoiceApiKey" ADD CONSTRAINT "VoiceApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
