import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../prisma/migrations/20260621120000_phase1_provider_customization/migration.sql",
  import.meta.url
);

test("Prisma stores optional per-character model and sampler overrides", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

  for (const [name, type] of [
    ["preferredProvider", "String?"],
    ["preferredModel", "String?"],
    ["temperature", "Float?"],
    ["topP", "Float?"],
    ["frequencyPenalty", "Float?"],
    ["presencePenalty", "Float?"],
    ["maxTokens", "Int?"],
    ["systemPromptOverride", "String?"]
  ]) {
    assert.match(schema, new RegExp(`${name}\\s+${type.replace(/[?]/g, "\\?")}`));
  }
});

test("Prisma stores fallback ordering and per-message usage metadata", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

  assert.match(schema, /fallbackEnabled\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /fallbackPriority\s+Int\?/);
  assert.match(schema, /provider\s+String\?/);
  assert.match(schema, /inputTokens\s+Int\?/);
  assert.match(schema, /outputTokens\s+Int\?/);
  assert.match(schema, /estimatedCost\s+Decimal\?\s+@db\.Decimal\(12, 8\)/);
  assert.match(schema, /usageEstimated\s+Boolean\?/);
});

test("the approved migration is additive and preserves existing rows", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ALTER TABLE "Character"\s+ADD COLUMN/);
  assert.match(migration, /ALTER TABLE "Message"\s+ADD COLUMN/);
  assert.match(migration, /ALTER TABLE "UserApiKey"\s+ADD COLUMN/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
});
