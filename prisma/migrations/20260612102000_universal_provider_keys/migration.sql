ALTER TABLE "UserApiKey"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "apiFormat" TEXT NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
  ADD COLUMN "baseUrl" TEXT,
  ADD COLUMN "defaultModel" TEXT;

UPDATE "UserApiKey"
SET
  "displayName" = CASE "provider"::TEXT
    WHEN 'OPENAI' THEN 'OpenAI'
    WHEN 'ANTHROPIC' THEN 'Anthropic'
    WHEN 'GEMINI' THEN 'Gemini'
    ELSE "provider"::TEXT
  END,
  "apiFormat" = CASE "provider"::TEXT
    WHEN 'OPENAI' THEN 'OPENAI'
    WHEN 'ANTHROPIC' THEN 'ANTHROPIC'
    WHEN 'GEMINI' THEN 'GEMINI'
    ELSE 'OPENAI_COMPATIBLE'
  END,
  "baseUrl" = CASE "provider"::TEXT
    WHEN 'OPENAI' THEN 'https://api.openai.com/v1'
    ELSE "baseUrl"
  END,
  "defaultModel" = CASE "provider"::TEXT
    WHEN 'OPENAI' THEN 'gpt-4o-mini'
    WHEN 'ANTHROPIC' THEN 'claude-3-5-sonnet-latest'
    WHEN 'GEMINI' THEN 'gemini-1.5-flash'
    ELSE "defaultModel"
  END;

ALTER TABLE "UserApiKey"
  ALTER COLUMN "displayName" SET NOT NULL;

DROP INDEX IF EXISTS "UserApiKey_userId_provider_key";

ALTER TABLE "UserApiKey"
  ALTER COLUMN "provider" TYPE TEXT USING lower("provider"::TEXT);

DROP TYPE IF EXISTS "LlmProvider";

CREATE UNIQUE INDEX "UserApiKey_userId_provider_key" ON "UserApiKey"("userId", "provider");
CREATE INDEX "UserApiKey_apiFormat_idx" ON "UserApiKey"("apiFormat");
