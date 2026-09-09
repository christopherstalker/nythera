import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { enforceFirstClassProviderConfig, FIRST_CLASS_PROVIDER_PRESETS } from "../src/lib/provider-presets";
import { openAIResponseOptions } from "../proxy-service/src/response-tokens";

test("DeepSeek is a dedicated first-class provider with its official direct endpoint", () => {
  const preset = FIRST_CLASS_PROVIDER_PRESETS.find((item) => item.provider === "deepseek");

  assert.deepEqual(preset, {
    provider: "deepseek",
    displayName: "DeepSeek",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    placeholder: "sk-..."
  });
});

test("DeepSeek routing metadata cannot be replaced with an OpenRouter endpoint", () => {
  const config = enforceFirstClassProviderConfig({
    provider: "deepseek",
    displayName: "OpenRouter",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-chat"
  });

  assert.equal(config.displayName, "DeepSeek");
  assert.equal(config.apiFormat, "OPENAI_COMPATIBLE");
  assert.equal(config.baseUrl, "https://api.deepseek.com");
  assert.equal(config.defaultModel, "deepseek-v4-flash");
});

test("DeepSeek uses the live V4 catalog and omits deprecated penalty parameters", async () => {
  const [options, gateway, proxy] = await Promise.all([
    readFile(new URL("../src/lib/provider-model-options.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8")
  ]);
  assert.match(options, /deepseek-v4-flash/);
  assert.match(options, /deepseek-v4-pro/);
  for (const source of [gateway, proxy]) {
    assert.match(source, /openAIResponseOptions\(input\)/);
  }
  const parameters = openAIResponseOptions({
    providerName: "deepseek",
    model: "deepseek-v4-flash",
    temperature: 0.7,
    maxTokens: 500,
    frequencyPenalty: 0.2,
    presencePenalty: 0.3
  });
  assert.equal(parameters.frequency_penalty, undefined);
  assert.equal(parameters.presence_penalty, undefined);
  assert.equal(parameters.max_tokens, 500);
});

test("both built-in and standalone gateways recognize DeepSeek model names", async () => {
  const builtInGateway = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const standaloneGateway = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  assert.match(builtInGateway, /normalized\.includes\("deepseek"\)[\s\S]+item\.provider === "deepseek"/);
  assert.match(standaloneGateway, /normalized\.includes\("deepseek"\)[\s\S]+item\.provider === "deepseek"/);
});
