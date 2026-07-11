-- DropIndex
DROP INDEX "Character_creatorId_idx";

-- DropIndex
DROP INDEX "Character_visibility_moderationStatus_createdAt_idx";

-- DropIndex
DROP INDEX "Chat_userId_lastActiveAt_idx";

-- DropIndex
DROP INDEX "Chat_userId_updatedAt_idx";

-- DropIndex
DROP INDEX "Message_chatId_createdAt_idx";

-- DropIndex
DROP INDEX "Message_chatId_createdAt_sequence_idx";

-- CreateIndex
CREATE INDEX "character_creator_updated_idx" ON "Character"("creatorId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "character_creator_clone_updated_idx" ON "Character"("creatorId", "cloneSourceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "character_discovery_trending_idx" ON "Character"("visibility", "moderationStatus", "isNSFW", "blockedAt", "likes" DESC, "ratingAverage" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "character_discovery_new_idx" ON "Character"("visibility", "moderationStatus", "isNSFW", "blockedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "character_discovery_rating_idx" ON "Character"("visibility", "moderationStatus", "isNSFW", "blockedAt", "ratingAverage" DESC, "ratingCount" DESC, "likes" DESC);

-- CreateIndex
CREATE INDEX "character_like_user_created_idx" ON "CharacterLike"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_user_archive_activity_idx" ON "Chat"("userId", "archivedAt", "lastActiveAt" DESC, "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "message_chat_created_sequence_id_idx" ON "Message"("chatId", "createdAt", "sequence", "id");
