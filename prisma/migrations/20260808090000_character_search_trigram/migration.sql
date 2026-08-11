CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Character_name_trgm_idx"
ON "Character" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Character_description_trgm_idx"
ON "Character" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Character_personality_trgm_idx"
ON "Character" USING GIN ("personality" gin_trgm_ops);
