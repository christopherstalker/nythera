ALTER TABLE "Memory" ADD COLUMN "sourceMessageId" TEXT;

CREATE INDEX "Memory_sourceMessageId_idx" ON "Memory"("sourceMessageId");

ALTER TABLE "Memory"
ADD CONSTRAINT "Memory_sourceMessageId_fkey"
FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
