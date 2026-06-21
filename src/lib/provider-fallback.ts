type FallbackKey = {
  provider: string;
  fallbackEnabled?: boolean;
  fallbackPriority?: number | null;
};

export function eligibleFallbackKeys<T extends FallbackKey>(primaryProvider: string, keys: T[]): T[] {
  return keys
    .filter((key) => key.provider !== primaryProvider && key.fallbackEnabled !== false)
    .sort((left, right) => {
      const leftPriority = left.fallbackPriority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.fallbackPriority ?? Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority || left.provider.localeCompare(right.provider);
    });
}
