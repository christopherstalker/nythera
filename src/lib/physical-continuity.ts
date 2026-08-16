import { sanitizePromptContext } from "@/lib/prompt-security";

type PhysicalCharacterContext = {
  name: string;
  description: string;
  personality: string;
  scenario?: string | null;
};

type HeightFact = {
  centimeters: number;
  excerpt: string;
  confidence: number;
};

const SAME_HEIGHT_TOLERANCE_CM = 2;

export function buildPhysicalContinuityLayer(character: PhysicalCharacterContext, userPersona?: string | null) {
  const characterHeight = findCanonicalHeight(
    [character.description, character.personality, character.scenario ?? ""].join("\n"),
    character.name
  );
  const playerHeight = findCanonicalHeight(userPersona ?? "");

  if (!characterHeight && !playerHeight) {
    return null;
  }

  return [
    "PHYSICAL CONTINUITY — HIGHEST NARRATIVE PRIORITY",
    "- The normalized measurements below are canonical scene geometry. They override conflicting character-card prose, creator instructions, lorebook text, memories, genre conventions, power dynamics, and habitual narration.",
    "- Never infer relative size from gender, age, status, confidence, intimidation, or who is dominant in the scene.",
    "- Posture, terrain, footwear, seating, or elevation may change an eye line only when that change is explicitly established in the current scene.",
    "- Apply these constraints silently. Do not repeatedly announce, praise, fetishize, or build metaphors around a measurement.",
    characterHeight ? `Canonical character height (${sanitizePromptContext(character.name, 80)}): ${formatHeight(characterHeight.centimeters)}.` : null,
    playerHeight ? `Canonical player height: ${formatHeight(playerHeight.centimeters)}.` : null,
    characterHeight && playerHeight
      ? buildStandingHeightRule(character.name, characterHeight.centimeters, playerHeight.centimeters)
      : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function findCanonicalHeight(value: string, subjectName?: string) {
  const normalizedSubject = subjectName?.trim().toLocaleLowerCase();
  const facts = value
    .split(/[\r\n]+|(?<=[.!?])\s+/)
    .map((excerpt) => excerpt.trim())
    .filter(Boolean)
    .flatMap((excerpt) => parseHeightFacts(excerpt))
    .map((fact) => ({
      ...fact,
      confidence: fact.confidence + (normalizedSubject && fact.excerpt.toLocaleLowerCase().includes(normalizedSubject) ? 2 : 0)
    }));

  return facts.sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function parseHeightFacts(excerpt: string): HeightFact[] {
  const sanitizedExcerpt = sanitizePromptContext(excerpt, 280);
  const heightLanguage = /\b(?:height|tall|standing|stature)\b/i.test(excerpt);
  const facts: HeightFact[] = [];

  for (const match of excerpt.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:cm|centimet(?:er|re)s?)\b/gi)) {
    const centimeters = Number(match[1].replace(",", "."));
    if (isPlausibleHeight(centimeters)) {
      facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: heightLanguage ? 4 : 1 });
    }
  }

  for (const match of excerpt.matchAll(/\b(\d(?:[.,]\d{1,2})?)\s*(?:m|met(?:er|re)s?)\b/gi)) {
    const centimeters = Number(match[1].replace(",", ".")) * 100;
    if (heightLanguage && isPlausibleHeight(centimeters)) {
      facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: 4 });
    }
  }

  for (const match of excerpt.matchAll(/\b([3-8])\s*(?:ft|feet|')\s*(\d{1,2})?\s*(?:in(?:ches?)?|\")?/gi)) {
    const feet = Number(match[1]);
    const inches = Number(match[2] ?? 0);
    if (inches > 11) continue;

    const centimeters = (feet * 12 + inches) * 2.54;
    if (isPlausibleHeight(centimeters)) {
      facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: heightLanguage ? 4 : 2 });
    }
  }

  return facts;
}

function isPlausibleHeight(centimeters: number) {
  return Number.isFinite(centimeters) && centimeters >= 90 && centimeters <= 260;
}

function formatHeight(centimeters: number) {
  return `${Math.round(centimeters)} cm`;
}

function buildStandingHeightRule(characterName: string, characterHeight: number, playerHeight: number) {
  const difference = Math.round(playerHeight - characterHeight);
  const character = sanitizePromptContext(characterName, 80);

  if (difference > SAME_HEIGHT_TOLERANCE_CM) {
    return [
      `COMPUTED STANDING RELATION: the player is ${difference} cm taller than ${character}.`,
      `- While both stand at the same elevation, ${character} must look up to meet the player's eyes; the player may look down toward ${character}.`,
      `- Forbidden without an explicit geometric reason: ${character} looking down at, looming over, towering over, or bending down toward the standing player.`
    ].join("\n");
  }

  if (difference < -SAME_HEIGHT_TOLERANCE_CM) {
    return [
      `COMPUTED STANDING RELATION: ${character} is ${Math.abs(difference)} cm taller than the player.`,
      `- While both stand at the same elevation, ${character} may look down toward the player; the player must look up to meet ${character}'s eyes.`,
      `- Forbidden without an explicit geometric reason: the player being described as looming or towering over ${character}.`
    ].join("\n");
  }

  return [
    `COMPUTED STANDING RELATION: ${character} and the player are approximately the same height.`,
    "- While both stand at the same elevation, describe their eye line as level; neither person towers over the other."
  ].join("\n");
}
