ALTER TABLE "User"
ADD COLUMN "defaultTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

UPDATE "User" AS users
SET "defaultTemperature" = latest."temperature"
FROM (
  SELECT DISTINCT ON ("userId")
    "userId",
    "temperature"
  FROM "Chat"
  ORDER BY "userId", "lastActiveAt" DESC, "updatedAt" DESC
) AS latest
WHERE users."id" = latest."userId";
