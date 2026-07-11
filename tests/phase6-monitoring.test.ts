import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("real user performance telemetry is mounted in the root layout", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

  assert.match(packageJson, /"@vercel\/speed-insights"/);
  assert.match(layout, /@vercel\/speed-insights\/next/);
  assert.match(layout, /<SpeedInsights\s*\/>/);
});

test("Prisma hot paths emit request-scoped query count and timing metrics", async () => {
  const prisma = await readFile(new URL("../src/lib/prisma.ts", import.meta.url), "utf8");
  const logger = await readFile(new URL("../src/lib/performance-logger.ts", import.meta.url), "utf8");
  const chatRoute = await readFile(new URL("../src/app/api/chats/[id]/route.ts", import.meta.url), "utf8");
  const discoveryFeed = await readFile(new URL("../src/lib/discovery-feed.ts", import.meta.url), "utf8");

  assert.match(prisma, /AsyncLocalStorage/);
  assert.match(prisma, /\$allOperations/);
  assert.match(logger, /queryCount/);
  assert.match(logger, /queryTimeMs/);
  assert.match(chatRoute, /operation:\s*"load_conversation"/);
  assert.match(discoveryFeed, /operation:\s*"discovery_feed"/);
});

test("chat streams log first-token timing for app and proxy provider paths", async () => {
  const appStreamRoute = await readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8");
  const gateway = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  assert.match(appStreamRoute, /chat_stream_first_token/);
  assert.match(gateway, /llm_time_to_first_token/);
  assert.match(proxy, /llm_time_to_first_token/);
  assert.doesNotMatch(gateway, /userId:\s*input\.userId/);
  assert.doesNotMatch(proxy, /userId,\s*$/m);
});
