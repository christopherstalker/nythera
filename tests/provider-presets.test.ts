import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_CLASS_PROVIDER_PRESETS,
  enforceFirstClassProviderConfig
} from "../src/lib/provider-presets";

const expectedProviders = ["openai", "anthropic", "gemini", "openrouter", "deepseek", "mistral", "groq", "xai"];

test("exposes every supported first-class provider exactly once", () => {
  assert.deepEqual(
    FIRST_CLASS_PROVIDER_PRESETS.map((preset) => preset.provider),
    expectedProviders
  );
});

test("configures new providers as direct official OpenAI-compatible APIs", () => {
  const byProvider = Object.fromEntries(
    FIRST_CLASS_PROVIDER_PRESETS.map((preset) => [preset.provider, preset])
  );

  assert.deepEqual(
    {
      openrouter: [byProvider.openrouter.apiFormat, byProvider.openrouter.baseUrl],
      mistral: [byProvider.mistral.apiFormat, byProvider.mistral.baseUrl],
      groq: [byProvider.groq.apiFormat, byProvider.groq.baseUrl],
      xai: [byProvider.xai.apiFormat, byProvider.xai.baseUrl]
    },
    {
      openrouter: ["OPENAI_COMPATIBLE", "https://openrouter.ai/api/v1"],
      mistral: ["OPENAI_COMPATIBLE", "https://api.mistral.ai/v1"],
      groq: ["OPENAI_COMPATIBLE", "https://api.groq.com/openai/v1"],
      xai: ["OPENAI_COMPATIBLE", "https://api.x.ai/v1"]
    }
  );
});

test("locks first-class provider configuration to its official endpoint", () => {
  assert.deepEqual(
    enforceFirstClassProviderConfig({
      provider: "xai",
      displayName: "Imposter",
      apiFormat: "OPENAI_COMPATIBLE" as const,
      baseUrl: "https://example.test/v1",
      defaultModel: "fake-model"
    }),
    {
      provider: "xai",
      displayName: "xAI (Grok)",
      apiFormat: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.x.ai/v1",
      defaultModel: "grok-4.3-latest"
    }
  );
});

test("preserves custom OpenAI-compatible endpoint configuration", () => {
  const custom = {
    provider: "local-vllm",
    displayName: "Local vLLM",
    apiFormat: "OPENAI_COMPATIBLE" as const,
    baseUrl: "http://127.0.0.1:8000/v1",
    defaultModel: "my-model"
  };

  assert.equal(enforceFirstClassProviderConfig(custom), custom);
});
