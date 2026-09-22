import type Anthropic from "@anthropic-ai/sdk";

export async function anthropicOutputTokenLimit(input: {
  client: Anthropic;
  model: string;
  maxTokens?: number | null;
  signal: AbortSignal;
}) {
  if (input.maxTokens != null) return input.maxTokens;

  // Anthropic requires max_tokens even when the user has not set a ceiling.
  const model = await input.client.models.retrieve(input.model, { signal: input.signal });
  const maximum = "max_tokens" in model ? model.max_tokens : null;
  if (typeof maximum !== "number" || !Number.isSafeInteger(maximum) || maximum <= 0) {
    throw new Error("Anthropic did not report this model's output capacity. Set an explicit output token limit.");
  }
  return maximum;
}

export function providerOutputTokenBudget(input: {
  visibleTokenLimit?: number | null;
  provider?: string | null;
  model?: string | null;
}) {
  // Reasoning shares the provider's completion budget; it must not raise the user's ceiling.
  return input.visibleTokenLimit ?? undefined;
}

export function openAIResponseOptions(input: {
  providerName: string;
  model: string;
  maxTokens?: number | null;
  temperature: number;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
}) {
  const reasoningModel = input.providerName === "openai" && /^(?:o[134](?:-|$)|gpt-5(?:[.-]|$))/.test(input.model);
  if (reasoningModel) {
    return { max_completion_tokens: input.maxTokens ?? undefined };
  }

  return {
    max_tokens: input.maxTokens ?? undefined,
    temperature: input.temperature,
    top_p: input.topP ?? undefined,
    frequency_penalty: input.providerName === "deepseek" ? undefined : (input.frequencyPenalty ?? undefined),
    presence_penalty: input.providerName === "deepseek" ? undefined : (input.presencePenalty ?? undefined)
  };
}

export function openRouterRoutingBody(providerName: string) {
  if (providerName !== "openrouter") {
    return {};
  }

  // OpenRouter otherwise load-balances by price/availability, which often picks a slow backend.
  return {
    provider: {
      sort: "latency" as const,
      allow_fallbacks: true
    }
  };
}

export function providerSdkMaxRetries(providerName: string, primaryKeyCount: number) {
  return primaryKeyCount > 1 || providerName === "openrouter" ? 0 : undefined;
}

export function geminiResponseOptions(model: string, maxTokens?: number | null) {
  const maxOutputTokens = maxTokens ?? undefined;
  if (maxTokens == null) return { maxOutputTokens };

  const modelName = model.replace(/^models\//, "");
  if (/^gemini-2\.5-flash(?:-|$)/.test(modelName)) {
    return { maxOutputTokens, thinkingConfig: { thinkingBudget: 0 } };
  }
  if (/^gemini-2\.5-pro(?:-|$)/.test(modelName)) {
    return { maxOutputTokens, thinkingConfig: { thinkingBudget: 128 } };
  }
  if (/^gemini-3(?:\.\d+)?-(?:flash|pro)(?:-|$)/.test(modelName) && !modelName.includes("image")) {
    return { maxOutputTokens, thinkingConfig: { thinkingLevel: "low" } };
  }
  return { maxOutputTokens };
}
