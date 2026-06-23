import assert from "node:assert/strict";
import test from "node:test";

import { characterCreateSchema } from "../src/lib/validation";
import { resolveCharacterModelSettings } from "../src/lib/character-model-settings";

const providerKeys = [
  {
    provider: "openai",
    displayName: "OpenAI",
    apiFormat: "OPENAI" as const,
    apiKey: "secret",
    defaultModel: "gpt-4o-mini",
    isDefault: true
  },
  {
    provider: "groq",
    displayName: "Groq",
    apiFormat: "OPENAI_COMPATIBLE" as const,
    apiKey: "secret",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    isDefault: false
  }
];

test("uses an available character provider and all character sampler overrides", () => {
  assert.deepEqual(
    resolveCharacterModelSettings({
      character: {
        preferredProvider: "groq",
        preferredModel: "llama-3.3-70b-versatile",
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0.2,
        presencePenalty: 0.3,
        maxTokens: 1200,
        systemPromptOverride: "Keep replies cinematic."
      },
      providerKeys,
      globalModel: "gpt-4o-mini",
      chatTemperature: 0.7
    }),
    {
      model: "groq:llama-3.3-70b-versatile",
      provider: "groq",
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0.2,
      presencePenalty: 0.3,
      maxTokens: 1200,
      systemPromptOverride: "Keep replies cinematic.",
      usedCharacterProvider: true,
      fellBackToGlobalProvider: false
    }
  );
});

test("falls back to the chatting user's global model when the character provider is unavailable", () => {
  const result = resolveCharacterModelSettings({
    character: {
      preferredProvider: "anthropic",
      preferredModel: "claude-sonnet-4-20250514",
      temperature: null,
      topP: null,
      frequencyPenalty: null,
      presencePenalty: null,
      maxTokens: null,
      systemPromptOverride: null
    },
    providerKeys,
    globalModel: "gpt-4o-mini",
    chatTemperature: 0.65
  });

  assert.equal(result.model, "gpt-4o-mini");
  assert.equal(result.provider, "openai");
  assert.equal(result.temperature, 0.65);
  assert.equal(result.usedCharacterProvider, false);
  assert.equal(result.fellBackToGlobalProvider, true);
});

test("explicit per-message provider model overrides the character preferred provider", () => {
  const result = resolveCharacterModelSettings({
    character: {
      preferredProvider: "groq",
      preferredModel: "llama-3.3-70b-versatile",
      temperature: 0.9,
      topP: null,
      frequencyPenalty: null,
      presencePenalty: null,
      maxTokens: null,
      systemPromptOverride: null
    },
    providerKeys,
    globalModel: "openai:gpt-4o-mini",
    chatTemperature: 0.65
  });

  assert.equal(result.model, "openai:gpt-4o-mini");
  assert.equal(result.provider, "openai");
  assert.equal(result.temperature, 0.9);
  assert.equal(result.usedCharacterProvider, false);
  assert.equal(result.fellBackToGlobalProvider, false);
});

test("validates optional sampler ranges on character input", () => {
  const valid = characterCreateSchema.safeParse({
    creationMode: "custom",
    name: "Sampler Test",
    description: "A sufficiently long description.",
    personality: "A sufficiently detailed personality for validation.",
    greeting: "Hello.",
    visibility: "PRIVATE",
    tags: [],
    isNSFW: false,
    preferredProvider: "groq",
    preferredModel: "llama-3.3-70b-versatile",
    temperature: 2,
    topP: 1,
    frequencyPenalty: -2,
    presencePenalty: 2,
    maxTokens: 32768,
    systemPromptOverride: "Favor dialogue over exposition."
  });
  assert.equal(valid.success, true);

  const invalid = characterCreateSchema.safeParse({
    creationMode: "custom",
    name: "Sampler Test",
    description: "A sufficiently long description.",
    personality: "A sufficiently detailed personality for validation.",
    greeting: "Hello.",
    temperature: 2.01,
    topP: 1.01,
    frequencyPenalty: -2.01,
    presencePenalty: 2.01,
    maxTokens: 32769
  });
  assert.equal(invalid.success, false);
});
