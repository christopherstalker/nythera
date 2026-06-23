import type { ProviderKeys } from "@/lib/user-keys";

export type CharacterModelOverrides = {
  preferredProvider?: string | null;
  preferredModel?: string | null;
  temperature?: number | null;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
  systemPromptOverride?: string | null;
};

export type EffectiveCharacterModelSettings = {
  model: string;
  provider: string | null;
  temperature: number;
  topP: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  maxTokens: number | null;
  systemPromptOverride: string | null;
  usedCharacterProvider: boolean;
  fellBackToGlobalProvider: boolean;
};

export function resolveCharacterModelSettings(input: {
  character: CharacterModelOverrides;
  providerKeys: ProviderKeys;
  globalModel: string;
  chatTemperature: number;
}): EffectiveCharacterModelSettings {
  const requestedProvider = input.character.preferredProvider?.trim().toLowerCase() || null;
  const requestedModel = input.character.preferredModel?.trim() || null;
  const explicitGlobalProvider = explicitProviderFromModel(input.globalModel, input.providerKeys);
  const matchingKey = requestedProvider
    ? input.providerKeys.find((key) => key.provider === requestedProvider)
    : null;
  const defaultKey = input.providerKeys.find((key) => key.isDefault) ?? input.providerKeys[0] ?? null;
  const useCharacterProvider = Boolean(!explicitGlobalProvider && matchingKey && (requestedModel || matchingKey?.defaultModel));
  const fellBackToGlobalProvider = Boolean(requestedProvider && !matchingKey);
  const model = useCharacterProvider
    ? `${matchingKey!.provider}:${requestedModel || matchingKey!.defaultModel}`
    : !explicitGlobalProvider && requestedModel && !requestedProvider
      ? requestedModel
      : input.globalModel;

  return {
    model,
    provider: explicitGlobalProvider ?? (useCharacterProvider ? matchingKey!.provider : defaultKey?.provider ?? null),
    temperature: input.character.temperature ?? input.chatTemperature,
    topP: input.character.topP ?? null,
    frequencyPenalty: input.character.frequencyPenalty ?? null,
    presencePenalty: input.character.presencePenalty ?? null,
    maxTokens: input.character.maxTokens ?? null,
    systemPromptOverride: input.character.systemPromptOverride?.trim() || null,
    usedCharacterProvider: useCharacterProvider,
    fellBackToGlobalProvider
  };
}

function explicitProviderFromModel(value: string, providerKeys: ProviderKeys) {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const provider = value.slice(0, separatorIndex).trim().toLowerCase();
  const model = value.slice(separatorIndex + 1).trim();
  if (!provider || !model) {
    return null;
  }

  return providerKeys.some((key) => key.provider === provider) ? provider : null;
}

export function redactCharacterModelSettings<
  T extends CharacterModelOverrides & Record<string, unknown>
>(character: T): Omit<T, keyof CharacterModelOverrides> {
  const {
    preferredProvider: _preferredProvider,
    preferredModel: _preferredModel,
    temperature: _temperature,
    topP: _topP,
    frequencyPenalty: _frequencyPenalty,
    presencePenalty: _presencePenalty,
    maxTokens: _maxTokens,
    systemPromptOverride: _systemPromptOverride,
    ...publicCharacter
  } = character;
  return publicCharacter;
}
