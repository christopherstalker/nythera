CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chatId" TEXT,
  "pathname" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "originalName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LookbookItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LookbookItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_pathname_key" ON "MediaAsset"("pathname");
CREATE INDEX "MediaAsset_userId_createdAt_idx" ON "MediaAsset"("userId", "createdAt" DESC);
CREATE INDEX "MediaAsset_userId_chatId_idx" ON "MediaAsset"("userId", "chatId");
CREATE UNIQUE INDEX "MessageAttachment_messageId_assetId_key" ON "MessageAttachment"("messageId", "assetId");
CREATE INDEX "MessageAttachment_messageId_position_idx" ON "MessageAttachment"("messageId", "position");
CREATE INDEX "MessageAttachment_assetId_idx" ON "MessageAttachment"("assetId");
CREATE UNIQUE INDEX "LookbookItem_userId_assetId_key" ON "LookbookItem"("userId", "assetId");
CREATE INDEX "LookbookItem_userId_updatedAt_idx" ON "LookbookItem"("userId", "updatedAt" DESC);

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LookbookItem" ADD CONSTRAINT "LookbookItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LookbookItem" ADD CONSTRAINT "LookbookItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
