ALTER TABLE "User" ADD COLUMN "preferredChatMode" TEXT NOT NULL DEFAULT 'realism';
ALTER TABLE "Character" ADD COLUMN "defaultChatMode" TEXT NOT NULL DEFAULT 'realism';

CREATE TABLE "ChatSidebarPin" (
  "userId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatSidebarPin_pkey" PRIMARY KEY ("userId", "characterId")
);

INSERT INTO "ChatSidebarPin" ("userId", "characterId", "createdAt")
SELECT "userId", "characterId", "createdAt" FROM "CharacterLike"
ON CONFLICT ("userId", "characterId") DO NOTHING;

CREATE INDEX "ChatSidebarPin_userId_createdAt_idx" ON "ChatSidebarPin"("userId", "createdAt" DESC);
CREATE INDEX "ChatSidebarPin_characterId_idx" ON "ChatSidebarPin"("characterId");

ALTER TABLE "ChatSidebarPin"
ADD CONSTRAINT "ChatSidebarPin_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatSidebarPin"
ADD CONSTRAINT "ChatSidebarPin_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
