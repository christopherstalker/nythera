export type ModelPrice = {
  provider: string;
  modelPrefix: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  effectiveDate: "2026-06-21";
  sourceUrl: string;
};

export const MODEL_PRICING: ModelPrice[] = [
  {
    provider: "openai",
    modelPrefix: "gpt-4o-mini",
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://platform.openai.com/docs/pricing"
  },
  {
    provider: "anthropic",
    modelPrefix: "claude-3-5-sonnet",
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing"
  },
  {
    provider: "anthropic",
    modelPrefix: "claude-sonnet-4",
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing"
  },
  {
    provider: "gemini",
    modelPrefix: "gemini-2.5-flash",
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing"
  },
  {
    provider: "deepseek",
    modelPrefix: "deepseek-chat",
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 0.28,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing"
  },
  {
    provider: "mistral",
    modelPrefix: "mistral-small",
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.3,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://mistral.ai/pricing"
  },
  {
    provider: "groq",
    modelPrefix: "llama-3.3-70b-versatile",
    inputUsdPerMillion: 0.59,
    outputUsdPerMillion: 0.79,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://groq.com/pricing"
  },
  {
    provider: "xai",
    modelPrefix: "grok-4.3",
    inputUsdPerMillion: 1.25,
    outputUsdPerMillion: 2.5,
    effectiveDate: "2026-06-21",
    sourceUrl: "https://docs.x.ai/developers/models"
  }
];

export function estimateModelCost(input: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const provider = input.provider.trim().toLowerCase();
  const model = input.model.trim().toLowerCase();
  const price = MODEL_PRICING
    .filter((entry) => entry.provider === provider && model.startsWith(entry.modelPrefix))
    .sort((left, right) => right.modelPrefix.length - left.modelPrefix.length)[0];

  if (!price) {
    return null;
  }

  const cost =
    (Math.max(0, input.inputTokens) / 1_000_000) * price.inputUsdPerMillion +
    (Math.max(0, input.outputTokens) / 1_000_000) * price.outputUsdPerMillion;
  return Number(cost.toFixed(8));
}
