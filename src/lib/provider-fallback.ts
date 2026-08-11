type FallbackKey = {
  provider: string;
  fallbackEnabled?: boolean;
  fallbackPriority?: number | null;
};

export function eligibleFallbackKeys<T extends FallbackKey>(primaryProvider: string, keys: T[]): T[] {
  return keys
    .filter((key) => key.provider !== primaryProvider && key.fallbackEnabled === true && key.fallbackPriority !== null && key.fallbackPriority !== undefined)
    .sort((left, right) => {
      const leftPriority = left.fallbackPriority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.fallbackPriority ?? Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority || left.provider.localeCompare(right.provider);
    });
}

export function providerFallbackNotice(attempts?: string[]) {
  if (!attempts || attempts.length < 2) return null;
  const primary = attempts[0].split(":", 1)[0];
  const answeredBy = attempts[attempts.length - 1].split(":", 1)[0];
  if (primary === answeredBy) return null;
  return `${displayProvider(primary)} could not complete this request, so ${displayProvider(answeredBy)} answered through your enabled fallback chain.`;
}

function displayProvider(provider: string) {
  const known: Record<string, string> = { gemini: "Gemini", deepseek: "DeepSeek", openai: "OpenAI", anthropic: "Anthropic", openrouter: "OpenRouter", groq: "Groq", mistral: "Mistral", xai: "xAI" };
  return known[provider] ?? provider;
}
