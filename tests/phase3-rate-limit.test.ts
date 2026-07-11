import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("route-specific fair-use buckets cover messages, proxy calls, and creation tools", async () => {
  const rateLimit = await readFile(new URL("../src/lib/rate-limit.ts", import.meta.url), "utf8");

  assert.match(rateLimit, /const MESSAGE_LIMIT:[\s\S]*perMinute:\s*20/);
  assert.match(rateLimit, /const AI_CREATION_LIMIT:[\s\S]*perMinute:\s*10/);
  for (const route of [
    "chat:stream",
    "mobile:chat:message",
    "rooms:message",
    "mobile:rooms:message",
    "proxy:llm",
    "characters:create",
    "characters:clone",
    "mobile:characters:create",
    "characters:generate",
    "characters:generate-prompt",
    "characters:assist",
    "user-persona:write",
    "mobile:user-persona:write",
    "memories:search",
    "mobile:memories:search",
    "voice:synthesize"
  ]) {
    assert.match(rateLimit, new RegExp(`"${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("429 responses include Retry-After and chat UI shows graceful copy", async () => {
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const useChat = await readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8");

  assert.match(api, /Retry-After/);
  assert.match(api, /retryAfterSeconds/);
  assert.match(useChat, /response\.status\s*===\s*429/);
  assert.match(useChat, /You're sending messages quickly\. One moment, then try again\./);
});

test("previously unprotected provider and persona surfaces enforce rate limits", async () => {
  const routes = await Promise.all(
    [
      "../src/app/api/proxy/llm/route.ts",
      "../src/app/api/user-persona/route.ts",
      "../src/app/api/mobile/user-persona/route.ts",
      "../src/app/api/memories/search/route.ts",
      "../src/app/api/mobile/memories/search/route.ts",
      "../src/app/api/memories/route.ts",
      "../src/app/api/mobile/memories/route.ts",
      "../src/app/api/mobile/auth/google/route.ts",
      "../src/app/api/voice/synthesize/route.ts",
      "../src/app/api/characters/[id]/route.ts",
      "../src/app/api/chats/[id]/branch/route.ts"
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
  );

  for (const source of routes) {
    assert.match(source, /enforceRateLimit/);
    assert.match(source, /getRequestIp/);
  }
});
