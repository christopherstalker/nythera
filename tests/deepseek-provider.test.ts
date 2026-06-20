import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { enforceFirstClassProviderConfig, FIRST_CLASS_PROVIDER_PRESETS } from "../src/lib/provider-presets";

test("DeepSeek is a dedicated first-class provider with its official direct endpoint", () => {
  const preset = FIRST_CLASS_PROVIDER_PRESETS.find((item) => item.provider === "deepseek");

  assert.deepEqual(preset, {
    provider: "deepseek",
    displayName: "DeepSeek",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
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
  assert.equal(config.defaultModel, "deepseek-chat");
});

test("both built-in and standalone gateways recognize DeepSeek model names", async () => {
  const builtInGateway = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const standaloneGateway = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  assert.match(builtInGateway, /normalized\.includes\("deepseek"\)[\s\S]+item\.provider === "deepseek"/);
  assert.match(standaloneGateway, /normalized\.includes\("deepseek"\)[\s\S]+item\.provider === "deepseek"/);
});
