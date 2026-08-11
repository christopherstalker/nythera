ALTER TABLE "Chat" ADD COLUMN "activeAssistantMessageId" TEXT;

ALTER TABLE "Message" ADD COLUMN "branchSourceMessageId" TEXT;

CREATE INDEX "Message_chatId_branchSourceMessageId_idx"
ON "Message"("chatId", "branchSourceMessageId");
