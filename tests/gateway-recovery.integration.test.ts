import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import type { StreamChunk, PromptMessage } from "../src/types";

const require = createRequire(import.meta.url);
for (const [modulePath, exports] of [
  ["server-only", {}],
  ["../src/lib/redis.ts", { redis: null }],
  ["../src/lib/safe-outbound-url.ts", { assertSafeOutboundUrl: async (url: string) => url }]
] as const) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}

test("gateway recovers BYOK, isolates canaries and retries oversized history", async (suite) => {
  const { streamGatewayResponse } = await import("../src/lib/llm-gateway");
  const { readProviderCircuitStates } = await import("../src/lib/provider-circuit");
  let mode: "unauthorized" | "context" | "success" = "success";
  const requests: { messages: PromptMessage[] }[] = [];
  const upstream = createServer(async (request, response) => {
    let body = "";
    for await (const part of request) body += part;
    requests.push(JSON.parse(body));
    if (mode === "unauthorized") {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Invalid API key" } }));
      return;
    }
    if (mode === "context" && requests.at(-1)!.messages.length > 3) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Maximum context length exceeded" } }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Recovered" }, finish_reason: null }] })}\n\n`);
    response.end("data: [DONE]\n\n");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  suite.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const key = { id: "recovery-fixture", provider: "fixture", displayName: "Fixture", apiFormat: "OPENAI_COMPATIBLE" as const, apiKey: "local-fixture", source: "user" as const, baseUrl, defaultModel: "fixture-model" };
  const messages: PromptMessage[] = [{ role: "system", content: "Preserve me" }, { role: "user", content: "Hello" }];
  const input = { userId: "fixture-user", chatId: "fixture-chat", model: "fixture:fixture-model", temperature: 0, messages, providerKeys: [key] };
  const collect = async (request: Parameters<typeof streamGatewayResponse>[0]) => {
    const chunks: StreamChunk[] = [];
    for await (const chunk of streamGatewayResponse(request)) chunks.push(chunk);
    return chunks;
  };

  await suite.test("personal retry reaches the provider despite an earlier credential cooldown", async () => {
    mode = "unauthorized";
    assert.ok((await collect(input)).some((chunk) => chunk.type === "error"));
    mode = "success";
    const before = requests.length;
    assert.ok((await collect(input)).some((chunk) => chunk.type === "done"));
    assert.equal(requests.length, before + 1);
  });

  await suite.test("failed Guardian probes do not quarantine user keys", async () => {
    mode = "unauthorized";
    await collect({ ...input, healthCheck: true });
    const states = await readProviderCircuitStates([{ provider: key.provider, keyId: key.id, model: key.defaultModel, credential: key.apiKey }]);
    assert.deepEqual(states, [false]);
  });

  await suite.test("context failure retries once without modifying the saved instructions", async () => {
    mode = "context";
    const instructions = "Long custom prompt. ".repeat(3000);
    const history: PromptMessage[] = [{ role: "system", content: instructions }, { role: "user", content: "Old" }, { role: "assistant", content: "Old reply" }, { role: "user", content: "Latest" }];
    const before = requests.length;
    assert.ok((await collect({ ...input, messages: history })).some((chunk) => chunk.type === "done"));
    assert.equal(requests.length, before + 2);
    assert.deepEqual(requests.at(-1)!.messages, [history[0], history[3]]);
  });
});
