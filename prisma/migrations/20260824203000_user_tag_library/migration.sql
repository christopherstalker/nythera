CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" VARCHAR(32) NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTag_userId_slug_key" ON "UserTag"("userId", "slug");
CREATE INDEX "UserTag_userId_lastUsedAt_idx" ON "UserTag"("userId", "lastUsedAt" DESC);

ALTER TABLE "UserTag"
ADD CONSTRAINT "UserTag_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserTag" (
    "id",
    "userId",
    "slug",
    "label",
    "useCount",
    "lastUsedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'tag_' || md5(character."creatorId" || ':' || tag.value),
    character."creatorId",
    tag.value,
    initcap(replace(tag.value, '-', ' ')),
    COUNT(*)::INTEGER,
    MAX(character."updatedAt"),
    MIN(character."createdAt"),
    MAX(character."updatedAt")
FROM "Character" AS character
CROSS JOIN LATERAL unnest(character."tags") AS tag(value)
WHERE length(tag.value) BETWEEN 2 AND 32
GROUP BY character."creatorId", tag.value
ON CONFLICT ("userId", "slug") DO NOTHING;
