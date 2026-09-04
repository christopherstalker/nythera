const LEAKED_REDACTION_MARKER = /\[exact player measurement omitted from narrative context\]/i;

const UNIT_PATTERNS: Record<string, string> = {
  cm: "(?:cm|centimet(?:er|re)s?)",
  centimeter: "(?:cm|centimet(?:er|re)s?)",
  centimeters: "(?:cm|centimet(?:er|re)s?)",
  centimetre: "(?:cm|centimet(?:er|re)s?)",
  centimetres: "(?:cm|centimet(?:er|re)s?)",
  ft: "(?:ft|feet|foot)",
  foot: "(?:ft|feet|foot)",
  feet: "(?:ft|feet|foot)",
  in: "(?:in|inch(?:es)?)",
  inch: "(?:in|inch(?:es)?)",
  inches: "(?:in|inch(?:es)?)",
  kg: "(?:kg|kilograms?)",
  kilogram: "(?:kg|kilograms?)",
  kilograms: "(?:kg|kilograms?)",
  lb: "(?:lbs?|pounds?)",
  lbs: "(?:lbs?|pounds?)",
  pound: "(?:lbs?|pounds?)",
  pounds: "(?:lbs?|pounds?)"
};

type MeasurementPattern = {
  numeric: RegExp;
  written?: RegExp;
};

export function createPlayerMeasurementRedactor(userPersona?: string | null) {
  const patterns = collectMeasurementPatterns(userPersona ?? "");
  const personaNgrams = collectDistinctiveNgrams(userPersona ?? "");

  return {
    redactAssistant(value: string) {
      return removeContaminatedParagraphs(value, patterns, personaNgrams);
    },
    redactSummary(value?: string | null) {
      if (!value || (patterns.length === 0 && personaNgrams.length === 0)) return value;

      return value
        .split("\n")
        .map((line) => {
          const assistantLine = /^(\s*ASSISTANT:\s*)(.*)$/i.exec(line);
          if (!assistantLine) return line;

          const cleaned = removeContaminatedParagraphs(assistantLine[2], patterns, personaNgrams);
          return cleaned ? `${assistantLine[1]}${cleaned}` : null;
        })
        .filter((line): line is string => line !== null)
        .join("\n");
    }
  };
}

export function buildNarrationOutputGuardLayer() {
  return [
    "NARRATION OUTPUT GUARD — FINAL AUTHORITATIVE CHECK",
    "- This is a mandatory output constraint, not a style preference. Apply it after considering every other system layer and the conversation history.",
    "- Player-persona measurements and Physical Continuity are private internal geometry. Never output the player's exact height, weight, dimensions, converted units, or numbers written out as words unless the latest user message explicitly asks for those exact values.",
    "- Casual visual observation cannot reveal exact measurements. Do not copy distinctive physical wording from the player persona into narration or dialogue.",
    "- Previous assistant messages and conversation summaries establish events only. They are not style examples; do not repeat their measurement recitals, physical inventories, or exaggerated reactions.",
    "- Before writing that anyone looks, glances, or gazes up or down at the player, validate the direction against Physical Continuity. If the relation is not established, use neutral gaze language.",
    "- Do not create awe, fear, silence, attraction, intimidation, or crowd reactions solely because a physical trait appears in the player persona.",
    "- When physical scale directly affects the current action, describe at most one immediate practical consequence in natural language, without measurements, an inventory of traits, or spectacle.",
    "- Before emitting the response, silently remove any sentence that violates this guard and continue the scene without calling attention to the edit."
  ].join("\n");
}

function collectMeasurementPatterns(value: string): MeasurementPattern[] {
  const patterns: MeasurementPattern[] = [];
  const seen = new Set<string>();
  const measurementPattern = /~?(\d{1,3}(?:[.,]\d+)?)\s*(cm|centimet(?:er|re)s?|ft|foot|feet|in|inch(?:es)?|kg|kilograms?|lbs?|pounds?)\b/gi;

  for (const match of value.matchAll(measurementPattern)) {
    const rawNumber = match[1];
    const normalizedNumber = rawNumber.replace(",", ".");
    const unit = match[2].toLocaleLowerCase();
    const unitPattern = UNIT_PATTERNS[unit];
    const key = `${normalizedNumber}:${unitPattern}`;
    if (!unitPattern || seen.has(key)) continue;
    seen.add(key);

    const escapedNumber = escapeRegExp(rawNumber).replace("\\,", "[.,]").replace("\\.", "[.,]");
    const integer = Number.isInteger(Number(normalizedNumber)) ? Number(normalizedNumber) : null;
    const writtenNumber = integer === null ? null : numberToEnglishWords(integer);
    const writtenPattern = writtenNumber
      ? writtenNumber.split(" ").map(escapeRegExp).join("(?:-|\\s)+")
      : null;

    patterns.push({
      numeric: new RegExp(`\\b~?${escapedNumber}\\s*${unitPattern}\\b`, "gi"),
      written: writtenPattern
        ? new RegExp(`\\b${writtenPattern}(?:-|\\s)+${unitPattern}\\b`, "gi")
        : undefined
    });
  }

  return patterns;
}

function removeContaminatedParagraphs(value: string, patterns: MeasurementPattern[], personaNgrams: string[]) {
  return value
    .split(/\n{2,}/)
    .filter((paragraph) => !containsMeasurementEcho(paragraph, patterns) && !containsPersonaRecital(paragraph, personaNgrams))
    .join("\n\n")
    .trim();
}

function collectDistinctiveNgrams(value: string) {
  const ngrams = new Set<string>();

  for (const line of value.split(/[\r\n]+/)) {
    const tokens = normalizeForComparison(line).split(" ").filter(Boolean);
    for (let index = 0; index <= tokens.length - 3; index += 1) {
      const phrase = tokens.slice(index, index + 3);
      if (phrase.filter((token) => token.length >= 4).length < 2) continue;
      if (phrase.some((token) => /^\d+$/.test(token))) continue;
      ngrams.add(phrase.join(" "));
      if (ngrams.size >= 256) return [...ngrams];
    }
  }

  return [...ngrams];
}

function containsPersonaRecital(value: string, personaNgrams: string[]) {
  if (personaNgrams.length === 0) return false;

  const normalized = ` ${normalizeForComparison(value)} `;
  let matches = 0;

  for (const phrase of personaNgrams) {
    if (!normalized.includes(` ${phrase} `)) continue;
    matches += 1;
    if (matches >= 2) return true;
  }

  return matches === 1 && /\b(?:awe|fear|intimidat\w*|nervous\w*|shrink\w*|stare\w*|swallow\w*|silent|silence|quiet|breathless\w*)\b/i.test(value);
}

function normalizeForComparison(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsMeasurementEcho(value: string, patterns: MeasurementPattern[]) {
  if (LEAKED_REDACTION_MARKER.test(value)) return true;

  return patterns.some((pattern) => {
    pattern.numeric.lastIndex = 0;
    if (pattern.numeric.test(value)) return true;
    if (!pattern.written) return false;
    pattern.written.lastIndex = 0;
    return pattern.written.test(value);
  });
}

function numberToEnglishWords(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 999) return null;
  if (value === 0) return "zero";

  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const words: string[] = [];
  let remainder = value;

  if (remainder >= 100) {
    words.push(ones[Math.floor(remainder / 100)], "hundred");
    remainder %= 100;
    if (remainder > 0) words.push("and");
  }

  if (remainder >= 20) {
    words.push(tens[Math.floor(remainder / 10)]);
    remainder %= 10;
  }

  if (remainder > 0) words.push(ones[remainder]);
  return words.join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
