ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "memoryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "compactMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CharacterRating" ADD COLUMN IF NOT EXISTS "review" TEXT;

CREATE TABLE IF NOT EXISTS "UserPersona" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "summary" TEXT NOT NULL,
  "background" TEXT,
  "traits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "likes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dislikes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "boundaries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPersona_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPersona_userId_key" ON "UserPersona"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserPersona_userId_fkey'
  ) THEN
    ALTER TABLE "UserPersona"
      ADD CONSTRAINT "UserPersona_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ChatShare" (
  "id" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "characterSnapshot" JSONB NOT NULL,
  "messagesSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "ChatShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatShare_chatId_idx" ON "ChatShare"("chatId");
CREATE INDEX IF NOT EXISTS "ChatShare_userId_createdAt_idx" ON "ChatShare"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChatShare_chatId_fkey'
  ) THEN
    ALTER TABLE "ChatShare"
      ADD CONSTRAINT "ChatShare_chatId_fkey"
      FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChatShare_userId_fkey'
  ) THEN
    ALTER TABLE "ChatShare"
      ADD CONSTRAINT "ChatShare_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
