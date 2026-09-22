CREATE TABLE "ChatContextTrace" (
    "messageId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    CONSTRAINT "ChatContextTrace_pkey" PRIMARY KEY ("messageId"),
    CONSTRAINT "ChatContextTrace_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LocalGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "lastMessageId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedMessageId" TEXT,
    CONSTRAINT "LocalGeneration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LocalGeneration_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LocalGeneration_userId_expiresAt_idx" ON "LocalGeneration"("userId", "expiresAt");
