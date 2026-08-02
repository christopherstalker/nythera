export type SavedProviderSummary = {
  provider: string;
  displayName: string;
  defaultModel?: string | null;
  last4?: string | null;
  isDefault?: boolean;
};

export type ProviderModelCatalog = Record<string, string[]>;

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
  gemini: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
  openrouter: ["openrouter/auto", "~openai/gpt-latest", "~anthropic/claude-sonnet-latest", "~google/gemini-pro-latest"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  xai: ["grok-4.3-latest"]
};

const PROVIDER_CONTEXT_WINDOWS: Record<string, number> = {
  openai: 128_000,
  anthropic: 200_000,
  gemini: 1_000_000,
  deepseek: 64_000,
  openrouter: 128_000,
  groq: 32_768,
  together: 32_768,
  mistral: 32_768,
  xai: 128_000
};

export const UNKNOWN_MODEL_CONTEXT_WINDOW = 8_192;

export function modelContextWindow(model?: string | null) {
  const parsed = splitProviderModelValue(model);
  if (parsed) {
    return PROVIDER_CONTEXT_WINDOWS[parsed.provider] ?? UNKNOWN_MODEL_CONTEXT_WINDOW;
  }

  const normalized = model?.trim().toLowerCase() ?? "";
  const provider = Object.keys(MODEL_SUGGESTIONS).find((candidate) =>
    MODEL_SUGGESTIONS[candidate].some((suggestion) => suggestion.toLowerCase() === normalized)
  );
  return provider ? PROVIDER_CONTEXT_WINDOWS[provider] : UNKNOWN_MODEL_CONTEXT_WINDOW;
}

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

export function modelSuggestionsForProvider(provider: string, defaultModel?: string | null, discoveredModels: string[] = []) {
  const normalizedProvider = provider.trim().toLowerCase();
  return Array.from(new Set([
    ...discoveredModels.map((model) => model.trim()),
    defaultModel?.trim(),
    ...(MODEL_SUGGESTIONS[normalizedProvider] ?? [])
  ].filter(Boolean) as string[]));
}

export function buildProviderModelGroups(keys: SavedProviderSummary[], catalog: ProviderModelCatalog = {}): ProviderModelGroup[] {
  return keys.map((key) => {
    const models = modelSuggestionsForProvider(key.provider, key.defaultModel, catalog[key.provider] ?? []);
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

  const explicit = splitProviderModelValue(trimmed);
  if (explicit && groups.some((group) => group.provider === explicit.provider)) {
    return providerModelValue(explicit.provider, explicit.model);
  }

  const byDefaultModel = groups
    .flatMap((group) => group.options)
    .find((option) => option.model.toLowerCase() === trimmed.toLowerCase());
  if (byDefaultModel) {
    return byDefaultModel.value;
  }

  return "";
}
