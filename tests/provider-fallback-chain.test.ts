import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { eligibleFallbackKeys } from "../src/lib/provider-fallback";

test("orders enabled fallback providers and excludes the primary and disabled keys", () => {
  const keys = [
    { provider: "openai", fallbackEnabled: true, fallbackPriority: 2 },
    { provider: "anthropic", fallbackEnabled: false, fallbackPriority: 0 },
    { provider: "groq", fallbackEnabled: true, fallbackPriority: 1 },
    { provider: "mistral", fallbackEnabled: true, fallbackPriority: 0 }
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
  assert.match(proxy, /fallbackEnabled\s*!==\s*false/);
  assert.match(proxy, /fallbackPriority/);
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
