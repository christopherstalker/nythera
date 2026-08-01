export type SavedProviderSummary = {
  provider: string;
  displayName: string;
  defaultModel?: string | null;
  last4?: string | null;
  isDefault?: boolean;
};

export type ProviderModelOption = {
  value: string;
  label: string;
  model: string;
  isDefault: boolean;
};

export type ProviderModelGroup = {
  provider: string;
  displayName: string;
  last4?: string | null;
  isDefault?: boolean;
  options: ProviderModelOption[];
};

export const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: ["openrouter/auto", "~openai/gpt-latest", "~anthropic/claude-sonnet-latest", "~google/gemini-pro-latest"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  xai: ["grok-4.3-latest"]
};

export function providerModelValue(provider: string, model: string) {
  return `${provider.trim().toLowerCase()}:${model.trim()}`;
}

export function splitProviderModelValue(value?: string | null) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  const separator = raw.indexOf(":");
  if (separator <= 0) {
    return null;
  }

  const provider = raw.slice(0, separator).trim().toLowerCase();
  const model = raw.slice(separator + 1).trim();
  if (!provider || !model) {
    return null;
  }

  return { provider, model };
}

export function userPreferredModelValue(user: {
  preferredProvider?: string | null;
  preferredModel?: string | null;
}) {
  const model = user.preferredModel?.trim() || "gpt-4o-mini";
  const explicit = splitProviderModelValue(model);
  if (explicit) {
    return providerModelValue(explicit.provider, explicit.model);
  }

  const provider = user.preferredProvider?.trim();
  return provider ? providerModelValue(provider, model) : model;
}

export function modelSuggestionsForProvider(provider: string, defaultModel?: string | null) {
  const normalizedProvider = provider.trim().toLowerCase();
  return Array.from(new Set([defaultModel?.trim(), ...(MODEL_SUGGESTIONS[normalizedProvider] ?? [])].filter(Boolean) as string[]));
}

export function buildProviderModelGroups(keys: SavedProviderSummary[]): ProviderModelGroup[] {
  return keys.map((key) => {
    const models = modelSuggestionsForProvider(key.provider, key.defaultModel);
    return {
      provider: key.provider,
      displayName: key.displayName,
      last4: key.last4,
      isDefault: key.isDefault,
      options: models.map((model) => ({
        value: providerModelValue(key.provider, model),
        label: model === key.defaultModel ? `${model} - default` : model,
        model,
        isDefault: model === key.defaultModel
      }))
    };
  });
}

export function defaultModelForProvider(provider: string) {
  return MODEL_SUGGESTIONS[provider]?.[0] ?? "gpt-4o-mini";
}

export function inferProviderModelValue(model: string | undefined, groups: ProviderModelGroup[]) {
  const trimmed = model?.trim();
  if (!trimmed) {
    return "";
  }
  if (groups.some((group) => group.options.some((option) => option.value === trimmed))) {
    return trimmed;
  }

  const byDefaultModel = groups
    .flatMap((group) => group.options)
    .find((option) => option.model.toLowerCase() === trimmed.toLowerCase());
  if (byDefaultModel) {
    return byDefaultModel.value;
  }

  return "";
}
