CREATE INDEX IF NOT EXISTS "Memory_embedding_ivfflat_idx"
  ON "Memory" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ANALYZE "Memory";
