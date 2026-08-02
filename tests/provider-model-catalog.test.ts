import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("provider models refresh server-side from official catalogs without exposing keys", async () => {
  const [catalog, route, settings] = await Promise.all([
    read("../src/lib/provider-model-catalog.ts"),
    read("../src/app/api/keys/models/route.ts"),
    read("../src/components/settings/key-settings-client.tsx")
  ]);
  assert.match(catalog, /generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.match(catalog, /\/models`/);
  assert.match(catalog, /\/user\/balance/);
  assert.match(catalog, /redis\.set/);
  assert.match(catalog, /MODEL_CATALOG_TTL_SECONDS/);
  assert.match(route, /requireUser/);
  assert.match(route, /getDecryptedProviderKeys/);
  assert.doesNotMatch(route, /apiKey\s*:/);
  assert.match(settings, /Live model catalog/);
  assert.match(settings, /Refresh models/);
});

test("Gemini receives native system instructions instead of flattened SYSTEM text", async () => {
  const [gateway, proxy] = await Promise.all([
    read("../src/lib/llm-gateway.ts"),
    read("../proxy-service/src/server.ts")
  ]);
  for (const source of [gateway, proxy]) {
    assert.match(source, /systemInstruction:/);
    assert.match(source, /role: message\.role === "assistant" \? "model" : "user"/);
    assert.doesNotMatch(source, /`\$\{message\.role\.toUpperCase\(\)\}: \$\{message\.content\}`/);
  }
});

test("personal BYOK requests bypass only Nythera's token-cost budget", async () => {
  const [keys, web, mobile] = await Promise.all([
    read("../src/lib/user-keys.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts")
  ]);
  assert.match(keys, /isUserOwnedProvider/);
  for (const source of [web, mobile]) {
    assert.match(source, /if \(!isUserOwnedProvider\(effectiveSettings\.provider, providerKeys\)\)/);
    assert.match(source, /route: "chat:stream"|route: "mobile:chat:message"/);
  }
});
