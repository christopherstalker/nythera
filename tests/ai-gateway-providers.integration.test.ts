import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { FIRST_CLASS_PROVIDER_PRESETS, enforceFirstClassProviderConfig } from "../src/lib/provider-presets";
import { buildProviderModelGroups, modelContextWindow } from "../src/lib/provider-model-options";
import type { ProviderKey } from "../src/lib/user-keys";

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

const gatewayKeys: ProviderKey[] = FIRST_CLASS_PROVIDER_PRESETS.filter((preset) =>
  ["vercel", "together", "fireworks"].includes(preset.provider)
).map((preset) => ({ ...preset, apiKey: "fixture-only", source: "user" }));

test("gateway credentials, catalogs and streaming use the selected service", async (suite) => {
  const originalFetch = globalThis.fetch;
  let providerFetch: typeof fetch;
  globalThis.fetch = (...args) => providerFetch(...args);
  suite.after(() => {
    globalThis.fetch = originalFetch;
  });
  require("openai/shims/web");
  const { validateProviderCredentials } = await import("../src/lib/provider-model-catalog");
  const { streamGatewayResponse } = await import("../src/lib/llm-gateway");

  for (const key of gatewayKeys) {
    await suite.test(`${key.provider} validates credentials and discovers chat models`, async () => {
      const urls: string[] = [];
      providerFetch = async (url, options) => {
        urls.push(String(url));
        assert.equal(new Headers(options?.headers).get("authorization"), "Bearer fixture-only");
        if (String(url).endsWith("/credits")) return Response.json({ balance: "0", total_used: "0" });
        return Response.json({ data: [{ id: key.defaultModel }, { id: "openai/text-embedding-3-small" }] });
      };
      const validation = await validateProviderCredentials(key);
      assert.ok(validation.ok);
      assert.deepEqual(validation.catalog.models, [key.defaultModel]);
      assert.deepEqual(
        urls,
        key.provider === "vercel" ? [`${key.baseUrl}/credits`, `${key.baseUrl}/models`] : [`${key.baseUrl}/models`]
      );
    });

    await suite.test(`${key.provider} keeps endpoint, authentication and model ID when streaming`, async () => {
      let calls = 0;
      const messages = [{ role: "user" as const, content: "Continue the story." }];
      providerFetch = async (url, options) => {
        calls++;
        assert.equal(String(url), `${key.baseUrl}/chat/completions`);
        assert.equal(new Headers(options?.headers).get("authorization"), "Bearer fixture-only");
        const request = JSON.parse(String(options?.body));
        assert.equal(request.model, key.defaultModel);
        assert.equal(request.stream, true);
        assert.deepEqual(request.messages, messages);
        return new Response(
          'data: {"choices":[{"delta":{"content":"The door opened."},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
          {
            headers: { "content-type": "text/event-stream" }
          }
        );
      };
      const chunks = [];
      for await (const chunk of streamGatewayResponse({
        model: `${key.provider}:${key.defaultModel}`,
        providerKeys: [key],
        messages,
        temperature: 0.7,
        userId: "fixture",
        chatId: "fixture",
        healthCheck: true
      }))
        chunks.push(chunk);
      assert.equal(calls, 1);
      assert.ok(chunks.some((chunk) => chunk.type === "done"));
      assert.ok(chunks.some((chunk) => chunk.type === "delta"));
      assert.ok(!chunks.some((chunk) => chunk.type === "error"));
    });
  }

  for (const provider of ["vercel", "custom-vercel"]) {
    await suite.test(`${provider} rejects an invalid key even though its catalog is public`, async () => {
      const urls: string[] = [];
      providerFetch = async (url) => {
        urls.push(String(url));
        return String(url).endsWith("/credits")
          ? Response.json({ error: { message: "Invalid key" } }, { status: 401 })
          : Response.json({ data: [{ id: "openai/gpt-5.4" }] });
      };
      const validation = await validateProviderCredentials({ ...gatewayKeys[0], provider });
      assert.ok(!validation.ok);
      assert.equal(validation.status, 400);
      assert.match(validation.message, /rejected this API key/);
      assert.deepEqual(urls, ["https://ai-gateway.vercel.sh/v1/credits"]);
    });
  }
});

test("gateway presets resist endpoint overrides and keep namespaced model choices", () => {
  for (const key of gatewayKeys) {
    const config = enforceFirstClassProviderConfig({
      provider: key.provider,
      displayName: "Override",
      apiFormat: "GEMINI",
      baseUrl: "https://example.test/v1",
      defaultModel: "wrong-model"
    });
    assert.equal(config.baseUrl, key.baseUrl);
    assert.equal(config.apiFormat, "OPENAI_COMPATIBLE");
    assert.equal(config.defaultModel, key.defaultModel);
    const [group] = buildProviderModelGroups([key], { [key.provider]: ["organization/custom-model"] });
    assert.ok(group.options.some((option) => option.value === `${key.provider}:organization/custom-model`));
    assert.ok(Number.isFinite(modelContextWindow(key.defaultModel)));
  }
});
