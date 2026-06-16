import crypto from "node:crypto";

import type { NytheraCharacterSeed } from "./schema";

export type DedupeResult = {
  accepted: NytheraCharacterSeed[];
  rejected: Array<{
    seed: NytheraCharacterSeed;
    reason: string;
    againstId?: string;
    score?: number;
  }>;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s"'.,!?-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(value: string, n: number) {
  const text = normalizeText(value);
  if (!text) return new Set<string>();
  const tokens = text.split(" ");
  const set = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i += 1) {
    set.add(tokens.slice(i, i + n).join(" "));
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) {
    if (large.has(item)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function stableHash(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

export function lexicalDiversityScore(value: string) {
  const text = normalizeText(value);
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length < 40) return 0;
  const unique = new Set(tokens);
  const ttr = unique.size / tokens.length;

  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
  const bigramRate = bigrams.size / Math.max(1, tokens.length - 1);

  // Weighted: penalize low-variance phrasing quickly.
  return Math.min(1, 0.55 * ttr + 0.45 * bigramRate);
}

export function fingerprint(seed: NytheraCharacterSeed) {
  const base = [
    seed.name,
    seed.archetype,
    seed.emotional_hook,
    seed.scenario,
    seed.greeting,
    seed.conversation_hooks.join(" | "),
    seed.tags.join(" | ")
  ].join("\n");
  return stableHash(base);
}

export function dedupeSeeds(input: NytheraCharacterSeed[], existing: NytheraCharacterSeed[] = []): DedupeResult {
  const accepted: NytheraCharacterSeed[] = [...existing];
  const rejected: DedupeResult["rejected"] = [];

  const nameSet = new Set(accepted.map((s) => normalizeText(s.name)));
  const idSet = new Set(accepted.map((s) => s.id));
  const fpSet = new Set(accepted.map((s) => fingerprint(s)));

  // Greeting anti-template: avoid many sharing the same opening cadence.
  const greetingStarts = new Map<string, number>();
  for (const seed of accepted) {
    const start = normalizeText(seed.greeting).slice(0, 42);
    greetingStarts.set(start, (greetingStarts.get(start) ?? 0) + 1);
  }

  const cachedShingles = new Map<string, { s3: Set<string>; s5: Set<string> }>();
  const getSh = (seed: NytheraCharacterSeed) => {
    const key = seed.id;
    const cached = cachedShingles.get(key);
    if (cached) return cached;
    const payload = `${seed.archetype}. ${seed.emotional_hook}\n${seed.scenario}\n${seed.greeting}`;
    const value = { s3: shingles(payload, 3), s5: shingles(payload, 5) };
    cachedShingles.set(key, value);
    return value;
  };

  const tooSimilar = (a: NytheraCharacterSeed, b: NytheraCharacterSeed) => {
    const as = getSh(a);
    const bs = getSh(b);
    const s3 = jaccard(as.s3, bs.s3);
    const s5 = jaccard(as.s5, bs.s5);
    // s5 is the stronger “template leakage” indicator.
    const score = Math.max(s3 * 0.65 + s5 * 0.35, s5);
    return { score, reject: score >= 0.28 || s5 >= 0.17 };
  };

  for (const seed of input) {
    const normName = normalizeText(seed.name);
    if (idSet.has(seed.id)) {
      rejected.push({ seed, reason: "duplicate_id" });
      continue;
    }
    if (nameSet.has(normName)) {
      rejected.push({ seed, reason: "duplicate_name" });
      continue;
    }
    const fp = fingerprint(seed);
    if (fpSet.has(fp)) {
      rejected.push({ seed, reason: "duplicate_fingerprint" });
      continue;
    }

    const diversity = lexicalDiversityScore(`${seed.greeting}\n${seed.scenario}`);
    if (diversity < 0.38) {
      rejected.push({ seed, reason: "low_lexical_diversity", score: diversity });
      continue;
    }

    const start = normalizeText(seed.greeting).slice(0, 42);
    const startCount = (greetingStarts.get(start) ?? 0) + 1;
    if (startCount >= 4) {
      rejected.push({ seed, reason: "greeting_opening_overused" });
      continue;
    }

    let rejectedBySimilarity = false;
    for (const prev of accepted.slice(-400)) {
      const { reject, score } = tooSimilar(seed, prev);
      if (reject) {
        rejected.push({ seed, reason: "too_similar_ngram", againstId: prev.id, score });
        rejectedBySimilarity = true;
        break;
      }
    }
    if (rejectedBySimilarity) continue;

    accepted.push(seed);
    idSet.add(seed.id);
    nameSet.add(normName);
    fpSet.add(fp);
    greetingStarts.set(start, startCount);
  }

  return { accepted: accepted.slice(existing.length), rejected };
}

