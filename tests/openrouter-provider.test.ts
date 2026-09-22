import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { enforceFirstClassProviderConfig, FIRST_CLASS_PROVIDER_PRESETS } from "../src/lib/provider-presets";
import { modelSuggestionsForProvider } from "../src/lib/provider-model-options";
import { openRouterRoutingBody, providerSdkMaxRetries } from "../proxy-service/src/response-tokens";

test("OpenRouter is a first-class key-only provider with a locked official endpoint", () => {
  const preset = FIRST_CLASS_PROVIDER_PRESETS.find((item) => item.provider === "openrouter");

  assert.deepEqual(preset, {
    provider: "openrouter",
    displayName: "OpenRouter",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
    placeholder: "sk-or-v1-..."
  });
  assert.deepEqual(
    enforceFirstClassProviderConfig({
      provider: "openrouter",
      displayName: "Tampered router",
      apiFormat: "OPENAI_COMPATIBLE",
      baseUrl: "https://example.test/v1",
      defaultModel: "fake-model"
    }),
    {
      provider: "openrouter",
      displayName: "OpenRouter",
      apiFormat: "OPENAI_COMPATIBLE",
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel: "openrouter/auto"
    }
  );
});

test("OpenRouter exposes automatic and stable-family model choices with attribution headers", async () => {
  assert.deepEqual(modelSuggestionsForProvider("openrouter").slice(0, 2), ["openrouter/auto", "~openai/gpt-latest"]);

  const [gateway, tokens, proxy] = await Promise.all([
    readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy-service/src/response-tokens.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8")
  ]);
  assert.match(gateway, /input\.key\.provider === "openrouter"/);
  assert.match(gateway, /"HTTP-Referer": CANONICAL_SITE_ORIGIN/);
  assert.match(gateway, /"X-Title": "Nythera"/);
  assert.match(gateway, /"X-OpenRouter-Title": "Nythera"/);
  assert.match(tokens, /sort:\s*"latency"/);
  for (const source of [gateway, proxy]) {
    assert.match(source, /openRouterRoutingBody\(input\.providerName\)/);
    assert.match(source, /providerSdkMaxRetries\(/);
    assert.match(source, /timeout:\s*LLM_PROVIDER_TIMEOUT_MS/);
  }
});

test("OpenRouter requests prefer the lowest-latency backend and skip SDK retries", () => {
  assert.deepEqual(openRouterRoutingBody("openrouter"), {
    provider: { sort: "latency", allow_fallbacks: true }
  });
  assert.deepEqual(openRouterRoutingBody("openai"), {});
  assert.equal(providerSdkMaxRetries("openrouter", 1), 0);
  assert.equal(providerSdkMaxRetries("openai", 1), undefined);
  assert.equal(providerSdkMaxRetries("openai", 2), 0);
});
