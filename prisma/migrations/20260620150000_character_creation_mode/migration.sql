CREATE TYPE "CharacterCreationMode" AS ENUM ('simple', 'custom');

ALTER TABLE "Character"
ADD COLUMN "creationMode" "CharacterCreationMode" NOT NULL DEFAULT 'custom';
