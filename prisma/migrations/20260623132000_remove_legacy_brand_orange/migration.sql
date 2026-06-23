ALTER TABLE "User"
ALTER COLUMN "accentColor" SET DEFAULT '#8F81F7';

UPDATE "User"
SET "accentColor" = '#8F81F7'
WHERE "accentColor" IN ('#FF7A18', '#FF5A0A', '#FFB52E', '#FFB347');