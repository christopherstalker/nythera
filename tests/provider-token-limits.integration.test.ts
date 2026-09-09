import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import type { ProviderKey } from "../src/lib/user-keys";
import { readProxyStream } from "../src/lib/proxy-stream";
import { resolveChatOutputTokenLimit } from "../src/lib/response-length";

const require = createRequire(import.meta.url);
for (const [modulePath, exports] of [
  ["server-only", {}],
  ["../src/lib/redis.ts", { redis: null }],
  ["../src/lib/performance-logger.ts", { logPerformanceMetric: () => {} }],
  [
    "../src/lib/safe-outbound-url.ts",
    {
      assertSafeOutboundUrl: async (url: string) => {
        assert.equal(new URL(url).origin, "https://openrouter.ai");
        return url;
      }
    }
  ]
] as const) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}

test("direct gateway and standalone proxy send identical ceilings and supported provider parameters", async (suite) => {
  const originalFetch = globalThis.fetch;
  suite.after(() => {
    globalThis.fetch = originalFetch;
  });
  await import(pathToFileURL(path.resolve("tests/fixtures/token-provider-fetch.mjs")).href);
  const { streamGatewayResponse } = await import("../src/lib/llm-gateway");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const port = address.port;
  const proxy = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      pathToFileURL(path.resolve("tests/fixtures/token-provider-fetch.mjs")).href,
      path.resolve("proxy-service/src/server.ts")
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        INTERNAL_API_TOKEN: "token-limit-fixture",
        AI_SHIELD_SIGNING_SECRET: "",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY: "",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        LOG_LEVEL: "silent"
      },
      stdio: "ignore",
      windowsHide: true
    }
  );
  suite.after(async () => {
    if (proxy.exitCode === null && proxy.signalCode === null) {
      const exited = once(proxy, "exit");
      proxy.kill();
      await exited;
    }
  });
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline) {
    assert.equal(proxy.exitCode, null, "proxy exited before readiness");
    try {
      ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok;
      if (ready) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, "proxy did not become ready");

  const providers = [
    { provider: "openai", apiFormat: "OPENAI", model: "gpt-4o-mini" },
    { provider: "openai", apiFormat: "OPENAI", model: "o3-mini" },
    { provider: "openai", apiFormat: "OPENAI", model: "gpt-5" },
    { provider: "anthropic", apiFormat: "ANTHROPIC", model: "claude-3-5-sonnet-latest" },
    { provider: "gemini", apiFormat: "GEMINI", model: "gemini-2.0-flash" },
    { provider: "gemini", apiFormat: "GEMINI", model: "gemini-2.5-flash" },
    { provider: "gemini", apiFormat: "GEMINI", model: "gemini-2.5-pro" },
    { provider: "gemini", apiFormat: "GEMINI", model: "gemini-3.6-flash" },
    {
      provider: "openrouter",
      apiFormat: "OPENAI_COMPATIBLE",
      model: "openai/gpt-5",
      baseUrl: "https://openrouter.ai/api/v1"
    }
  ] as const;

  for (const provider of providers) {
    for (const maxTokens of [128, 500, 4096, null]) {
      await suite.test(`${provider.provider}/${provider.model}: ${maxTokens} tokens`, async () => {
        const key: ProviderKey = {
          ...provider,
          displayName: "Token fixture",
          apiKey: "fixture-only",
          defaultModel: provider.model,
          source: "user"
        };
        const input = {
          userId: "token-fixture",
          chatId: "token-fixture",
          healthCheck: true,
          model: `${provider.provider}:${provider.model}`,
          temperature: 0.7,
          topP: 0.9,
          frequencyPenalty: 0.1,
          presencePenalty: 0.2,
          maxTokens,
          messages: [{ role: "user" as const, content: "Say hello." }],
          providerKeys: [key]
        };
        let gatewayText = "";
        let gatewayDone = false;
        for await (const chunk of streamGatewayResponse(input)) {
          assert.notEqual(chunk.type, "error", JSON.stringify(chunk));
          if (chunk.type === "delta") gatewayText += chunk.text;
          if (chunk.type === "done") gatewayDone = true;
        }
        assert.ok(gatewayDone);
        const response = await fetch(`http://127.0.0.1:${port}/v1/chat/stream`, {
          method: "POST",
          headers: { authorization: "Bearer token-limit-fixture", "content-type": "application/json" },
          body: JSON.stringify(input)
        });
        assert.equal(response.status, 200);
        assert.ok(response.body);
        let proxyText = "";
        let proxyDone = false;
        for await (const chunk of readProxyStream(response.body, () => {})) {
          assert.notEqual(chunk.type, "error", JSON.stringify(chunk));
          if (chunk.type === "delta") proxyText += chunk.text;
          if (chunk.type === "done") proxyDone = true;
        }
        assert.ok(proxyDone);
        const gatewayRequest = JSON.parse(gatewayText).request;
        const proxyRequest = JSON.parse(proxyText).request;
        if (provider.apiFormat === "GEMINI") {
          assert.deepEqual(proxyRequest.generationConfig, gatewayRequest.generationConfig);
          assert.equal(gatewayRequest.generationConfig.maxOutputTokens, maxTokens ?? undefined);
          if (maxTokens === null) assert.equal(gatewayRequest.generationConfig.thinkingConfig, undefined);
          if (maxTokens !== null && provider.model === "gemini-2.5-flash")
            assert.deepEqual(gatewayRequest.generationConfig.thinkingConfig, { thinkingBudget: 0 });
          if (maxTokens !== null && provider.model === "gemini-2.5-pro")
            assert.deepEqual(gatewayRequest.generationConfig.thinkingConfig, { thinkingBudget: 128 });
          if (maxTokens !== null && provider.model === "gemini-3.6-flash")
            assert.deepEqual(gatewayRequest.generationConfig.thinkingConfig, { thinkingLevel: "low" });
        } else {
          assert.deepEqual(proxyRequest, gatewayRequest);
          const reasoning = provider.provider === "openai" && provider.model !== "gpt-4o-mini";
          assert.equal(
            gatewayRequest[reasoning ? "max_completion_tokens" : "max_tokens"],
            maxTokens ?? (provider.provider === "anthropic" ? 8192 : undefined)
          );
          if (reasoning) {
            for (const field of ["max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"])
              assert.equal(gatewayRequest[field], undefined);
          }
        }
      });
    }
  }

  await suite.test("changing the global cap down, up, and clearing it changes the actual request ceiling", async () => {
    for (const [savedCap, expected] of [
      [128, 128],
      [4096, 4096],
      [null, undefined]
    ] as const) {
      let reply = "";
      for await (const chunk of streamGatewayResponse({
        userId: "token-fixture",
        chatId: "token-fixture",
        healthCheck: true,
        model: "gemini:gemini-2.5-flash",
        temperature: 0.7,
        maxTokens: resolveChatOutputTokenLimit(null, savedCap),
        messages: [{ role: "user", content: "Say hello." }],
        providerKeys: [
          {
            provider: "gemini",
            displayName: "Token fixture",
            apiFormat: "GEMINI",
            apiKey: "fixture-only",
            defaultModel: "gemini-2.5-flash"
          }
        ]
      })) {
        assert.notEqual(chunk.type, "error", JSON.stringify(chunk));
        if (chunk.type === "delta") reply += chunk.text;
      }
      assert.equal(JSON.parse(reply).request.generationConfig.maxOutputTokens, expected);
    }
  });
});
