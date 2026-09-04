UPDATE "Memory"
SET status = 'ACTIVE'::"MemoryStatus"
WHERE status = 'PENDING'::"MemoryStatus"
  AND metadata->>'extractor' IN ('contextual-exchange', 'rule', 'topic-keyword', 'llm');
