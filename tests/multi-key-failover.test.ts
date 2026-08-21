import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("provider keys support multiple ordered rows per provider", async () => {
  const [schema, migration, keyStore] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260809203000_multi_provider_keys/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/user-keys.ts", import.meta.url), "utf8")
  ]);

  const userApiKeyModel = schema.match(/model UserApiKey \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(userApiKeyModel, /@@unique\(\[userId, provider\]\)/);
  assert.match(schema, /providerPriority\s+Int\s+@default\(0\)/);
  assert.match(migration, /DROP INDEX "UserApiKey_userId_provider_key"/);
  assert.match(keyStore, /userApiKey\.create/);
  assert.match(keyStore, /providerPriority/);
});

test("key APIs update and remove individual credentials", async () => {
  const [keyRoute, modelsRoute, settings] = await Promise.all([
    readFile(new URL("../src/app/api/keys/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/keys/models/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/settings/key-settings-client.tsx", import.meta.url), "utf8")
  ]);

  assert.match(keyRoute, /searchParams\.get\("id"\)/);
  assert.match(modelsRoute, /where: \{ id: representative\.id, userId: user\.id \}/);
  assert.match(settings, /failover pool/);
  assert.match(settings, /Verify and add backup key/);
});

test("same-provider retries precede cross-provider fallbacks", async () => {
  const [gateway, proxy, notices] = await Promise.all([
    readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/provider-fallback.ts", import.meta.url), "utf8")
  ]);

  for (const source of [gateway, proxy]) {
    assert.match(source, /attemptRoutes\(route,/);
    assert.match(source, /key\.provider === primary\.providerName/);
    assert.match(source, /canTryAnotherRoute = Boolean\(nextAttempt\) && isKeyScopedFailure/);
  }
  assert.match(gateway, /MAX_SAME_PROVIDER_ATTEMPTS = 4/);
  assert.match(gateway, /rotatePrimaryKey/);
  assert.match(gateway, /setKeyCooldown/);
  assert.match(gateway, /All \$\{keyCount\} saved keys/);
  assert.match(gateway, /LLM provider attempt failed/);
  assert.match(gateway, /providerOutputTokenBudget\(\{/);
  assert.match(gateway, /Provider returned an empty response/);
  assert.match(proxy, /providerOutputTokenBudget\(parsed\.data\.maxTokens, attempt\.provider\)/);
  assert.match(proxy, /Provider returned an empty response/);
  assert.match(proxy, /streamed\.slice\(streamedBeforeAttempt\)\.trim\(\)/);
  assert.match(notices, /if \(primary === answeredBy\) return null/);
});

test("personal keys stay in the Vercel gateway where rotation and cooldown are enforced", async () => {
  const proxyClient = await readFile(new URL("../src/lib/proxy.ts", import.meta.url), "utf8");

  assert.match(proxyClient, /key\.source === "user"/);
  assert.match(proxyClient, /usesPersonalKeys/);
});
