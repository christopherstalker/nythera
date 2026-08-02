import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { eligibleFallbackKeys, providerFallbackNotice } from "../src/lib/provider-fallback";

test("orders only explicitly configured fallback providers and excludes implicit keys", () => {
  const keys = [
    { provider: "openai", fallbackEnabled: true, fallbackPriority: 2 },
    { provider: "anthropic", fallbackEnabled: false, fallbackPriority: 0 },
    { provider: "groq", fallbackEnabled: true, fallbackPriority: 1 },
    { provider: "mistral", fallbackEnabled: true, fallbackPriority: 0 },
    { provider: "deepseek", fallbackEnabled: true, fallbackPriority: null }
  ];

  assert.deepEqual(
    eligibleFallbackKeys("openai", keys).map((key) => key.provider),
    ["mistral", "groq"]
  );
});

test("both gateways honor explicit fallback enablement and order", async () => {
  const builtIn = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  assert.match(builtIn, /eligibleFallbackKeys/);
  assert.match(proxy, /fallbackEnabled\s*===\s*true/);
  assert.match(proxy, /fallbackPriority\s*!==\s*null/);
  assert.match(proxy, /fallbackPriority/);
});

test("a completed fallback reports which provider actually answered", () => {
  assert.equal(
    providerFallbackNotice(["gemini:gemini-3.6-flash", "deepseek:deepseek-v4-flash"]),
    "Gemini could not complete this request, so DeepSeek answered through your enabled fallback chain."
  );
  assert.equal(providerFallbackNotice(["gemini:gemini-3.6-flash"]), null);
});

test("new and previously implicit keys are not automatic fallbacks", async () => {
  const [schema, migration, keys] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260802170000_explicit_provider_fallback/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/user-keys.ts", import.meta.url), "utf8")
  ]);
  assert.match(schema, /fallbackEnabled\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /WHERE "fallbackPriority" IS NULL/);
  assert.match(keys, /fallbackEnabled: false/);
});

test("fallback settings have a dedicated authenticated API and ordering UI", async () => {
  const route = await readFile(new URL("../src/app/api/keys/fallback/route.ts", import.meta.url), "utf8");
  const settings = await readFile(new URL("../src/components/settings/key-settings-client.tsx", import.meta.url), "utf8");

  assert.match(route, /requireUser/);
  assert.match(route, /updateUserProviderFallbacks/);
  assert.match(settings, /Fallback chain/);
  assert.match(settings, /Move .* up/i);
  assert.match(settings, /Move .* down/i);
  assert.doesNotMatch(route, /encryptedKey/);
});
