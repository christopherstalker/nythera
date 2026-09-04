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

  if (!playerHeight) {
    return null;
  }

  return [
    "PHYSICAL CONTINUITY — INTERNAL GEOMETRY",
    "- The standing relation below is canonical scene geometry. It overrides conflicting character-card prose, creator instructions, lorebook text, memories, genre conventions, power dynamics, and habitual narration.",
    "- Height is a vertical coordinate. Never collapse it into generic size, mass, width, muscularity, presence, status, or dominance.",
    "- Never infer relative size from gender, age, status, confidence, intimidation, or who is dominant in the scene.",
    "- Posture, terrain, footwear, seating, or elevation may change an eye line only when that change is explicitly established in the current scene.",
    "- A previous assistant message that reversed the eye line is an error, not scene evidence. Correct the geometry silently on the next relevant beat.",
    "- Apply these constraints silently. They are continuity inputs, never narration content.",
    characterHeight
      ? buildStandingHeightRule(character.name, characterHeight.centimeters, playerHeight.centimeters)
      : buildPlayerHeightRule(character.name, playerHeight.centimeters)
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
  const heightLanguage = /\b(?:height|tall|standing|stature)\b|(?:рост|высот|высок|низк)/iu.test(excerpt);
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

function buildPlayerHeightRule(characterName: string, playerHeight: number) {
  const character = sanitizePromptContext(characterName, 80);
  const relation = heightRelativeToOrdinaryAdult(playerHeight);
  const privatePlayerHeight = `${Math.round(playerHeight * 10) / 10} cm`;

  return [
    `PRIVATE PLAYER HEIGHT: ${privatePlayerHeight}. Use this number only to compute spatial relations; never quote, paraphrase, convert, or reveal it in the response.`,
    `PLAYER STANDING HEIGHT: The player's standing eye line is ${relation} an ordinary adult's. This is a literal height fact, not a statement about overall body size.`,
    `- ${character}'s exact height is not stated in the card. If you have high-confidence, well-established canonical knowledge of ${character}'s height, compare it with the private player height and follow the resulting eye line. Card facts always win over remembered canon.`,
    `- Do not invent a taller ${character} or narrate ${character} looking down at the player from habit, authority, confidence, or scene framing.`,
    `- ${character} may look down at the player only when card facts, high-confidence canonical knowledge, or an explicit current-scene elevation establish ${character}'s eyes above the player's.`,
    "- When the relative eye line is still genuinely unknown, use neutral gaze language instead of looking up or down."
  ].join("\n");
}

function heightRelativeToOrdinaryAdult(centimeters: number) {
  if (centimeters >= 205) return "far above";
  if (centimeters >= 190) return "above";
  if (centimeters <= 150) return "far below";
  if (centimeters <= 165) return "below";
  return "within the usual range of";
}

function isPlausibleHeight(centimeters: number) {
  return Number.isFinite(centimeters) && centimeters >= 90 && centimeters <= 260;
}

function buildStandingHeightRule(characterName: string, characterHeight: number, playerHeight: number) {
  const difference = playerHeight - characterHeight;
  const character = sanitizePromptContext(characterName, 80);

  if (difference > SAME_HEIGHT_TOLERANCE_CM) {
    return [
      `COMPUTED STANDING RELATION: ${character}'s standing eye line is below the player's.`,
      `- While both stand at the same elevation, ${character} must look up to meet the player's eyes; the player may look down toward ${character}.`,
      `- Do not reverse this vertical eye-line unless posture, terrain, seating, or elevation supplies an explicit geometric reason.`
    ].join("\n");
  }

  if (difference < -SAME_HEIGHT_TOLERANCE_CM) {
    return [
      `COMPUTED STANDING RELATION: ${character}'s standing eye line is above the player's.`,
      `- While both stand at the same elevation, ${character} may look down toward the player; the player must look up to meet ${character}'s eyes.`,
      `- Do not reverse this vertical eye-line unless posture, terrain, seating, or elevation supplies an explicit geometric reason.`
    ].join("\n");
  }

  return [
    `COMPUTED STANDING RELATION: ${character} and the player are approximately the same height.`,
    "- While both stand at the same elevation, keep their eye line level."
  ].join("\n");
}
