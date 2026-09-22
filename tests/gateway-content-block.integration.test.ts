import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import type { ProviderKey } from "../src/lib/user-keys";
import type { StreamChunk } from "../src/types";

const require = createRequire(import.meta.url);
for (const [modulePath, exports] of [
  ["server-only", {}],
  ["../src/lib/redis.ts", { redis: null }],
  ["../src/lib/performance-logger.ts", { logPerformanceMetric: () => {} }],
  ["../src/lib/secret-redaction.ts", { logSafeError: () => {} }],
  ["../src/lib/safe-outbound-url.ts", { assertSafeOutboundUrl: async (url: string) => url }]
] as const) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}

test("content blocks preserve billing errors without retrying keys or quarantining Gemini", async (suite) => {
  const originalFetch = globalThis.fetch;
  suite.after(() => {
    globalThis.fetch = originalFetch;
  });
  const calls: string[] = [];
  let blocked = true;
  globalThis.fetch = async (request) => {
    const url = request instanceof Request ? request.url : String(request);
    const host = new URL(url).hostname;
    calls.push(host);
    if (host === "openrouter.ai") {
      return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
    }
    assert.equal(host, "generativelanguage.googleapis.com");
    const response = blocked
      ? { promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }
      : { candidates: [{ content: { role: "model", parts: [{ text: "Hello" }] }, finishReason: "STOP", index: 0 }] };
    return new Response(`data: ${JSON.stringify(response)}\n\n`, {
      headers: { "content-type": "text/event-stream" }
    });
  };
  await import("openai/shims/web");
  require("openai/shims/web");
  const { streamGatewayResponse } = await import("../src/lib/llm-gateway");
  const { readProviderCircuitStates } = await import("../src/lib/provider-circuit");
  const geminiKeys: ProviderKey[] = Array.from({ length: 4 }, (_, index) => ({
    id: `content-block-gemini-${index}`,
    provider: "gemini",
    displayName: "Gemini",
    apiFormat: "GEMINI",
    apiKey: `fixture-gemini-${index}`,
    source: "user",
    defaultModel: "gemini-flash-lite-latest",
    providerPriority: index,
    fallbackEnabled: true,
    fallbackPriority: index + 1
  }));
  const openrouterKey: ProviderKey = {
    id: "content-block-openrouter",
    provider: "openrouter",
    displayName: "OpenRouter",
    apiFormat: "OPENAI_COMPATIBLE",
    apiKey: "fixture-openrouter",
    source: "user",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "x-ai/grok-4.6"
  };
  const collect = async (model: string, providerKeys: ProviderKey[]) => {
    const chunks: StreamChunk[] = [];
    for await (const chunk of streamGatewayResponse({
      userId: "content-block-user",
      chatId: "content-block-chat",
      model,
      temperature: 0,
      messages: [{ role: "user", content: "Hello" }],
      providerKeys
    }))
      chunks.push(chunk);
    return chunks;
  };

  const failed = await collect("openrouter:x-ai/grok-4.6", [openrouterKey, ...geminiKeys]);
  assert.deepEqual(calls, ["openrouter.ai", "generativelanguage.googleapis.com"]);
  const failure = failed.find((chunk) => chunk.type === "error");
  assert.ok(failure?.type === "error");
  assert.match(failure.message, /OpenRouter:.*credits/);
  assert.match(failure.message, /Gemini:.*content policy/);
  assert.equal(
    failed.some((chunk) => chunk.type === "done"),
    false
  );
  assert.doesNotMatch(failure.message, /fixture-|PROHIBITED_CONTENT/);

  for (let index = 0; index < 4; index++) {
    const before = calls.length;
    await collect("gemini:gemini-flash-lite-latest", geminiKeys);
    assert.equal(calls.length, before + 1);
  }
  const states = await readProviderCircuitStates(
    geminiKeys.map((key) => ({
      provider: key.provider,
      model: key.defaultModel!,
      credential: key.apiKey,
      keyId: key.id
    }))
  );
  assert.deepEqual(states, [false, false, false, false]);

  blocked = false;
  const recovered = await collect("gemini:gemini-flash-lite-latest", geminiKeys);
  assert.ok(recovered.some((chunk) => chunk.type === "done"));
  assert.ok(recovered.some((chunk) => chunk.type === "delta" && chunk.text === "Hello"));
});
