export type LorebookEntry = {
  id?: string;
  keywords: string[];
  text: string;
};

export type MatchedLorebookEntry = LorebookEntry & {
  matchedKeywords: string[];
};

export function parseLorebookEntries(value: unknown): LorebookEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const entries = Array.isArray((value as { entries?: unknown }).entries)
    ? (value as { entries: unknown[] }).entries
    : [];

  return entries
    .map<LorebookEntry | null>((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const keywords = Array.isArray(record.keywords)
        ? record.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 12)
        : [];
      const text = typeof record.text === "string" ? record.text.trim() : "";

      const id = typeof record.id === "string" ? record.id : undefined;
      return keywords.length && text ? { ...(id ? { id } : {}), keywords, text } : null;
    })
    .filter((entry): entry is LorebookEntry => Boolean(entry))
    .slice(0, 24);
}

export function matchLorebookEntries(value: unknown, texts: string[], limit = 8): MatchedLorebookEntry[] {
  const searchable = texts
    .filter(Boolean)
    .join("\n")
    .normalize("NFKC")
    .toLocaleLowerCase("und");

  if (!searchable) {
    return [];
  }

  return parseLorebookEntries(value)
    .map((entry) => {
      const matchedKeywords = entry.keywords.filter((keyword) =>
        searchable.includes(keyword.normalize("NFKC").toLocaleLowerCase("und"))
      );
      return matchedKeywords.length ? { ...entry, matchedKeywords } : null;
    })
    .filter((entry): entry is MatchedLorebookEntry => Boolean(entry))
    .slice(0, Math.max(0, limit));
}
