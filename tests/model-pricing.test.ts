import assert from "node:assert/strict";
import test from "node:test";

import { MODEL_PRICING, estimateModelCost } from "../src/lib/model-pricing";

test("calculates message cost from input and output token prices", () => {
  assert.equal(
    estimateModelCost({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000
    }),
    0.75
  );
});

test("supports the current defaults for every first-class provider", () => {
  const cases = [
    ["openai", "gpt-4o-mini"],
    ["anthropic", "claude-3-5-sonnet-latest"],
    ["gemini", "gemini-2.5-flash"],
    ["deepseek", "deepseek-chat"],
    ["mistral", "mistral-small-latest"],
    ["groq", "llama-3.3-70b-versatile"],
    ["xai", "grok-4.3-latest"]
  ] as const;

  for (const [provider, model] of cases) {
    assert.equal(typeof estimateModelCost({ provider, model, inputTokens: 1000, outputTokens: 1000 }), "number");
  }
});

test("returns null instead of inventing a price for an unknown model", () => {
  assert.equal(
    estimateModelCost({ provider: "local-vllm", model: "private-model", inputTokens: 1000, outputTokens: 1000 }),
    null
  );
});

test("pricing entries are dated and link to official provider sources", () => {
  assert.ok(MODEL_PRICING.every((entry) => entry.effectiveDate === "2026-06-21"));
  assert.ok(MODEL_PRICING.every((entry) => entry.sourceUrl.startsWith("https://")));
});
