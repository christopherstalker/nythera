import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("gateways request and prefer provider-returned usage metadata", async () => {
  const builtIn = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  for (const source of [builtIn, proxy]) {
    assert.match(source, /stream_options:\s*\{\s*include_usage:\s*true\s*\}/);
    assert.match(source, /usageMetadata/);
    assert.match(source, /input_tokens/);
    assert.match(source, /output_tokens/);
    assert.match(source, /usageEstimated/);
  }
});

test("desktop and mobile routes persist usage and estimated cost on assistant messages", async () => {
  for (const path of [
    "../src/app/api/chats/[id]/stream/route.ts",
    "../src/app/api/mobile/chats/[id]/message/route.ts"
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /estimateModelCost/);
    assert.match(source, /provider:\s*usage\.provider/);
    assert.match(source, /inputTokens:\s*usage\.inputTokens/);
    assert.match(source, /outputTokens:\s*usage\.outputTokens/);
    assert.match(source, /estimatedCost/);
    assert.match(source, /usageEstimated:\s*usage\.usageEstimated/);
  }
});

test("assistant message bubbles display token usage and estimated USD cost", async () => {
  const bubble = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  const list = await readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8");

  assert.match(bubble, /inputTokens/);
  assert.match(bubble, /outputTokens/);
  assert.match(bubble, /Estimated cost/i);
  assert.match(list, /estimatedCost=\{/);
});
