CREATE TYPE "DiscoveryPlacement" AS ENUM ('STANDARD', 'FEATURED', 'WIDE');

ALTER TABLE "Character"
ADD COLUMN "discoveryPlacement" "DiscoveryPlacement" NOT NULL DEFAULT 'STANDARD';

WITH ranked_public_characters AS (
  SELECT
    "id",
    row_number() OVER (
      ORDER BY "likes" DESC, "ratingAverage" DESC, "createdAt" DESC
    ) AS rank
  FROM "Character"
  WHERE
    "visibility" = 'PUBLIC'
    AND "moderationStatus" = 'APPROVED'
    AND "blockedAt" IS NULL
)
UPDATE "Character"
SET "discoveryPlacement" =
  CASE
    WHEN ranked_public_characters.rank = 1 THEN 'FEATURED'::"DiscoveryPlacement"
    WHEN ranked_public_characters.rank = 2 THEN 'WIDE'::"DiscoveryPlacement"
    ELSE "Character"."discoveryPlacement"
  END
FROM ranked_public_characters
WHERE "Character"."id" = ranked_public_characters."id"
  AND ranked_public_characters.rank IN (1, 2);
