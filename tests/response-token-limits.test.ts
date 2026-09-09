import assert from "node:assert/strict";
import test from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { resolveChatOutputTokenLimit, providerOutputTokenBudget } from "../src/lib/response-length";
import {
  anthropicOutputTokenLimit,
  geminiResponseOptions,
  openAIResponseOptions
} from "../proxy-service/src/response-tokens";
import { fitPromptMessagesWithinContext, historyTokenBudget } from "../src/lib/prompt-budget";

test("only explicit global and character limits cap generation; clearing both removes the cap", () => {
  for (const characterLimit of [null, 128, 700, 4096]) {
    for (const userLimit of [null, 128, 512, 2048, 4096]) {
      assert.equal(
        resolveChatOutputTokenLimit(characterLimit, userLimit),
        characterLimit === null && userLimit === null
          ? null
          : Math.min(characterLimit ?? Infinity, userLimit ?? Infinity)
      );
    }
  }
});

test("provider reasoning never expands a resolved cap, including at the 4096 boundary", () => {
  for (const provider of ["openai", "anthropic", "gemini", "openai-compatible"]) {
    for (const visibleTokenLimit of [128, 240, 480, 1050, 3000, 4096]) {
      assert.equal(providerOutputTokenBudget({ visibleTokenLimit, provider }), visibleTokenLimit);
    }
    assert.equal(providerOutputTokenBudget({ provider }), undefined);
    assert.equal(providerOutputTokenBudget({ provider, visibleTokenLimit: null }), undefined);
  }
});

test("Anthropic uses model capacity only for an unset limit and never guesses a fallback cap", async () => {
  let lookups = 0;
  let capacity: unknown = 8192;
  const signal = new AbortController().signal;
  const client = {
    models: {
      retrieve: async (model: string, options: { signal: AbortSignal }) => {
        lookups++;
        assert.equal(model, "claude-fixture");
        assert.equal(options.signal, signal);
        return { max_tokens: capacity };
      }
    }
  } as unknown as Anthropic;
  const input = { client, model: "claude-fixture", signal };
  assert.equal(await anthropicOutputTokenLimit({ ...input, maxTokens: 500 }), 500);
  assert.equal(lookups, 0);
  assert.equal(await anthropicOutputTokenLimit({ ...input, maxTokens: null }), 8192);
  for (capacity of [null, undefined, "8192", 0, -1, 1.5, Infinity]) {
    await assert.rejects(anthropicOutputTokenLimit(input), /did not report this model's output capacity/);
  }
});

test("Gemini thinking controls respect model support and stay inside the completion cap", () => {
  assert.deepEqual(geminiResponseOptions("gemini-2.5-flash-lite", 128), {
    maxOutputTokens: 128,
    thinkingConfig: { thinkingBudget: 0 }
  });
  assert.deepEqual(geminiResponseOptions("models/gemini-2.5-pro", 512), {
    maxOutputTokens: 512,
    thinkingConfig: { thinkingBudget: 128 }
  });
  assert.deepEqual(geminiResponseOptions("gemini-3.6-flash", 512), {
    maxOutputTokens: 512,
    thinkingConfig: { thinkingLevel: "low" }
  });
  assert.deepEqual(geminiResponseOptions("gemini-2.0-flash", 512), { maxOutputTokens: 512 });
  assert.deepEqual(geminiResponseOptions("custom-model", 512), { maxOutputTokens: 512 });
  assert.deepEqual(geminiResponseOptions("gemini-3.1-flash-lite-image", 512), { maxOutputTokens: 512 });
  assert.deepEqual(geminiResponseOptions("gemini-2.5-pro", null), { maxOutputTokens: undefined });
});

test("OpenAI reasoning caps do not leak native-only parameters to compatible providers", () => {
  const input = {
    model: "gpt-5",
    maxTokens: 512,
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0.1,
    presencePenalty: 0.2
  };
  for (const model of ["o1", "o3-mini", "o4-mini", "gpt-5", "gpt-5.2"]) {
    assert.deepEqual(openAIResponseOptions({ ...input, model, providerName: "openai" }), {
      max_completion_tokens: 512
    });
  }
  for (const providerName of ["openrouter", "local-vllm"]) {
    assert.deepEqual(openAIResponseOptions({ ...input, providerName }), {
      max_tokens: 512,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.2
    });
  }
});

test("history selection and final prompt fitting reserve the same capped generation budget", () => {
  const model = "gpt-4o";
  const smallCap = providerOutputTokenBudget({ visibleTokenLimit: 512, provider: "gemini" });
  const largeCap = providerOutputTokenBudget({ visibleTokenLimit: 4096, provider: "gemini" });
  assert.equal(
    historyTokenBudget({ model, maxOutputTokens: smallCap, currentMessage: "Hello" }) -
      historyTokenBudget({ model, maxOutputTokens: largeCap, currentMessage: "Hello" }),
    4096 - 512
  );
  const messages = [
    { role: "system" as const, content: "Stay in character." },
    { role: "user" as const, content: "Hello" }
  ];
  assert.equal(
    fitPromptMessagesWithinContext(messages, { model, maxOutputTokens: smallCap }).tokenBudget -
      fitPromptMessagesWithinContext(messages, { model, maxOutputTokens: largeCap }).tokenBudget,
    4096 - 512
  );
});
