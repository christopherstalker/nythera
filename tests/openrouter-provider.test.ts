import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { enforceFirstClassProviderConfig, FIRST_CLASS_PROVIDER_PRESETS } from "../src/lib/provider-presets";
import { modelSuggestionsForProvider } from "../src/lib/provider-model-options";

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

  const gateway = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  assert.match(gateway, /input\.key\.provider === "openrouter"/);
  assert.match(gateway, /"HTTP-Referer": CANONICAL_SITE_ORIGIN/);
  assert.match(gateway, /"X-OpenRouter-Title": "Nythera"/);
});
