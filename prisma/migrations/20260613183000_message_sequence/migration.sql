-- Add a per-chat message sequence as an ordering fallback when timestamps collide.
ALTER TABLE "Message" ADD COLUMN "sequence" INTEGER;

CREATE UNIQUE INDEX "Message_chatId_sequence_key" ON "Message"("chatId", "sequence");
CREATE INDEX "Message_chatId_createdAt_sequence_idx" ON "Message"("chatId", "createdAt", "sequence");
