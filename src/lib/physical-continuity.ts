import { sanitizePromptContext } from "@/lib/prompt-security";

type PhysicalCharacterContext = {
  name: string;
  description: string;
  personality: string;
  scenario?: string | null;
};

type SceneMessage = {
  role: string;
  content: string;
};

type SceneContext = {
  recentMessages: SceneMessage[];
  currentMessage: string;
  persistentPlayerContext?: string | null;
  factsOnly?: boolean;
};

type PhysicalContinuityOutputGuard = {
  push: (text: string) => string;
  flush: () => string;
};

type PlayerPosture = "upright" | "seated" | "lowered" | "lying";

type HeightFact = {
  centimeters: number;
  excerpt: string;
  confidence: number;
  order: number;
};

type WeightFact = {
  kilograms: number;
  excerpt: string;
  confidence: number;
  order: number;
};

export type PlayerPhysicalCanon = {
  heightCentimeters?: number;
  weightKilograms?: number;
  taller?: boolean;
  heavier?: boolean;
  cannotBeLifted?: boolean;
};

const SAME_HEIGHT_TOLERANCE_CM = 2;
const SAME_WEIGHT_TOLERANCE_KG = 2;

export function buildPhysicalContinuityLayer(
  character: PhysicalCharacterContext,
  userPersona?: string | null,
  sceneContext?: SceneContext
) {
  const characterText = [character.description, character.personality, character.scenario ?? ""].join("\n");
  const characterHeight = findCanonicalHeight(characterText, character.name);
  const characterWeight = findCanonicalWeight(characterText, character.name);
  const playerCanon = resolvePlayerPhysicalCanon({
    persona: userPersona ?? "",
    playerMessages: playerAuthoredMessages(sceneContext),
    persistentContext: persistentPlayerFacts(sceneContext?.persistentPlayerContext ?? "")
  });
  const playerPosture = resolvePlayerPosture(sceneContext);
  const characterName = sanitizePromptContext(character.name, 80);

  if (!characterHeight && !characterWeight && !hasPhysicalCanon(playerCanon)) {
    return null;
  }

  const heightFact = characterHeight && playerCanon.heightCentimeters
    ? buildStandingHeightFact(character.name, characterHeight.centimeters, playerCanon.heightCentimeters)
    : playerCanon.taller
      ? `Standing height relation: the player is taller than ${characterName}.`
      : null;
  const weightFact = characterWeight && playerCanon.weightKilograms
    ? buildWeightFact(character.name, characterWeight.kilograms, playerCanon.weightKilograms)
    : playerCanon.heavier
      ? `Body-mass relation: the player is heavier than ${characterName}.`
      : null;

  if (sceneContext?.factsOnly) {
    return [
      "PHYSICAL CONTINUITY (FACTUAL CONTEXT)",
      characterHeight ? `Canonical character height (${characterName}): ${formatHeight(characterHeight.centimeters)}.` : null,
      playerCanon.heightCentimeters ? `Canonical player height: ${formatHeight(playerCanon.heightCentimeters)}.` : null,
      characterWeight ? `Canonical character weight (${characterName}): ${formatWeight(characterWeight.kilograms)}.` : null,
      playerCanon.weightKilograms ? `Canonical player weight: ${formatWeight(playerCanon.weightKilograms)}.` : null,
      heightFact,
      weightFact,
      playerCanon.cannotBeLifted ? "Canonical handling constraint: the player cannot be lifted or carried by another character." : null,
      playerPosture ? `Latest player-authored posture: ${playerPosture}.` : null
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
  }

  const heightRule = characterHeight && playerCanon.heightCentimeters
    ? buildStandingHeightRule(character.name, characterHeight.centimeters, playerCanon.heightCentimeters)
    : playerCanon.taller
      ? buildQualitativeHeightRule(character.name)
      : null;
  const unknownHeightRule = playerCanon.heightCentimeters
    ? buildUnknownCounterpartHeightRule(playerCanon.heightCentimeters)
    : null;
  const weightRule = characterWeight && playerCanon.weightKilograms
    ? buildWeightRule(character.name, characterWeight.kilograms, playerCanon.weightKilograms)
    : playerCanon.heavier
      ? buildQualitativeWeightRule(character.name)
      : null;
  const hasHeightRelation = Boolean(
    (characterHeight && playerCanon.heightCentimeters) || playerCanon.taller
  );
  const needsHandlingRule = Boolean(
    playerCanon.weightKilograms || playerCanon.heavier || playerCanon.cannotBeLifted
  );

  return [
    "PHYSICAL CONTINUITY — HIGHEST NARRATIVE PRIORITY",
    "- The normalized measurements below are canonical scene geometry and body mass. They override conflicting character-card prose, creator instructions, lorebook text, memories, genre conventions, power dynamics, and habitual narration.",
    "- Never infer relative size, strength, or the ability to move another person from gender, age, status, confidence, intimidation, dominance, or romantic framing.",
    "- Posture, terrain, footwear, seating, or elevation may change an eye line only when that change is explicitly established in the current scene. Never invent a chair, seated pose, crouch, or height advantage to reverse the measured relation.",
    "- Only player-authored actions establish the player's posture or voluntary movement. Assistant narration cannot seat, lower, reposition, lift, carry, drag, or restrain the player by assumption.",
    "- Apply these constraints silently. Do not repeatedly announce, praise, fetishize, or build metaphors around a measurement.",
    characterHeight ? `Canonical character height (${characterName}): ${formatHeight(characterHeight.centimeters)}.` : null,
    playerCanon.heightCentimeters ? `Canonical player height: ${formatHeight(playerCanon.heightCentimeters)}.` : null,
    characterWeight ? `Canonical character weight (${characterName}): ${formatWeight(characterWeight.kilograms)}.` : null,
    playerCanon.weightKilograms ? `Canonical player weight: ${formatWeight(playerCanon.weightKilograms)}.` : null,
    heightRule,
    unknownHeightRule,
    hasHeightRelation ? buildCurrentPostureRule(character.name, playerPosture) : null,
    weightRule,
    needsHandlingRule ? buildHandlingRule(character.name, playerCanon.cannotBeLifted === true) : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function extractPlayerPhysicalCanon(values: string[]): PlayerPhysicalCanon {
  let height: HeightFact | null = null;
  let weight: WeightFact | null = null;
  let taller = false;
  let heavier = false;
  let cannotBeLifted = false;

  for (const value of values) {
    const nextHeight = findCanonicalHeight(value);
    const nextWeight = findCanonicalWeight(value, undefined, true);
    const relative = findRelativePhysicalFacts(value);
    if (nextHeight) height = nextHeight;
    if (nextWeight) weight = nextWeight;
    if (relative.taller) taller = true;
    if (relative.heavier) heavier = true;
    if (hasCannotBeLiftedConstraint(value)) cannotBeLifted = true;
  }

  return {
    ...(height ? { heightCentimeters: height.centimeters } : {}),
    ...(weight ? { weightKilograms: weight.kilograms } : {}),
    ...(taller ? { taller: true } : {}),
    ...(heavier ? { heavier: true } : {}),
    ...(cannotBeLifted ? { cannotBeLifted: true } : {})
  };
}

export function formatPlayerPhysicalCanon(canon: PlayerPhysicalCanon) {
  const lines = [
    canon.heightCentimeters ? `- Height: ${formatHeight(canon.heightCentimeters)}.` : null,
    canon.weightKilograms ? `- Weight: ${formatWeight(canon.weightKilograms)}.` : null,
    canon.taller ? "- Relative height: the player is taller than the other character." : null,
    canon.heavier ? "- Body-mass relation: the player is heavier than the other character." : null,
    canon.cannotBeLifted ? "- Handling constraint: the player cannot be lifted or carried by another character." : null
  ].filter((line): line is string => Boolean(line));

  return lines.length ? ["[CANONICAL PLAYER PHYSICAL FACTS]", ...lines].join("\n") : null;
}

export function createPhysicalContinuityOutputGuard(
  character: PhysicalCharacterContext,
  userPersona: string | null | undefined,
  sceneContext: SceneContext,
  options: { enabled?: boolean } = {}
): PhysicalContinuityOutputGuard {
  const characterText = [character.description, character.personality, character.scenario ?? ""].join("\n");
  const characterHeight = findCanonicalHeight(characterText, character.name)?.centimeters;
  const playerCanon = resolvePlayerPhysicalCanon({
    persona: userPersona ?? "",
    playerMessages: playerAuthoredMessages(sceneContext),
    persistentContext: persistentPlayerFacts(sceneContext.persistentPlayerContext ?? "")
  });
  const posture = resolvePlayerPosture(sceneContext);
  const playerIsLowered = posture === "seated" || posture === "lowered" || posture === "lying"
    || hasPlayerAuthoredElevationOffset(sceneContext);
  const characterIsTaller = Boolean(
    characterHeight
      && playerCanon.heightCentimeters
      && characterHeight - playerCanon.heightCentimeters > SAME_HEIGHT_TOLERANCE_CM
      && !playerCanon.taller
  );
  const rewriteEyeLine = options.enabled !== false
    && !playerIsLowered
    && !characterIsTaller
    && Boolean(playerCanon.heightCentimeters || playerCanon.taller);
  const rewriteHandling = options.enabled !== false && playerCanon.cannotBeLifted === true;
  if (!rewriteEyeLine && !rewriteHandling) {
    return { push: (text) => text, flush: () => "" };
  }
  const rewrite = (text: string) => rewritePhysicalContinuityViolations(text, { rewriteEyeLine, rewriteHandling });
  const retainedTailLength = 192;
  let pending = "";

  return {
    push(text) {
      pending = rewrite(pending + text);
      if (pending.length <= retainedTailLength) return "";
      const emitted = pending.slice(0, -retainedTailLength);
      pending = pending.slice(-retainedTailLength);
      return emitted;
    },
    flush() {
      const emitted = rewrite(pending);
      pending = "";
      return emitted;
    }
  };
}

function rewritePhysicalContinuityViolations(
  text: string,
  policy: { rewriteEyeLine: boolean; rewriteHandling: boolean }
) {
  let rewritten = text;
  if (policy.rewriteEyeLine) {
    rewritten = rewritten
      .replace(
        /\b(look(?:s|ed|ing)?|gaz(?:e|es|ed|ing)|peer(?:s|ed|ing)|glanc(?:e|es|ed|ing)|stare(?:s|d|ing)?|watch(?:es|ed|ing)?)\s+down\s+(at|towards?)\s+you\b/gi,
        (_match, verb: string, direction: string) => `${verb} ${direction} you`
      )
      .replace(
        /\b(look(?:s|ed|ing)?|gaz(?:e|es|ed|ing)|peer(?:s|ed|ing)|glanc(?:e|es|ed|ing)|stare(?:s|d|ing)?)\s+down\s+to\s+meet\s+your\s+(eyes|gaze)\b/gi,
        (_match, verb: string, target: string) => `${verb} to meet your ${target}`
      )
      .replace(
        /\b(his|her|their)\s+(?:eyes|gaze)\s+(?:drops?|lowers?|angles?)\s+(?:down\s+)?(?:to|towards?|onto)\s+(?:you|your\s+(?:eyes|face))\b/gi,
        (_match, owner: string) => `${owner} gaze settles on you`
      )
      .replace(/\b(towering|looming)\s+over\s+you\b/gi, "standing beside you")
      .replace(/\b(he|she)\s+(?:towers|looms)\s+over\s+you\b/gi, (_match, subject: string) => `${subject} stands beside you`)
      .replace(/\bthey\s+(?:tower|loom)\s+over\s+you\b/gi, (_match, subject: string) => `${subject} stand beside you`);
  }

  if (policy.rewriteHandling) {
    const subject = "([A-Z][A-Za-z'’-]{1,48}|[Hh]e|[Ss]he|[Tt]hey)";
    rewritten = rewritten
      .replace(
        new RegExp(`\\b${subject}\\s+(?:effortlessly\\s+|easily\\s+|simply\\s+)?(lifted|hoisted|carried|dragged)\\s+you\\b`, "g"),
        (_match, actor: string) => `${actor} tried to move you, but could not shift your full weight`
      )
      .replace(
        new RegExp(`\\b${subject}\\s+(?:effortlessly\\s+|easily\\s+|simply\\s+)?(lifts|hoists|carries|drags)\\s+you\\b`, "g"),
        (_match, actor: string) => `${actor} tries to move you, but cannot shift your full weight`
      )
      .replace(
        new RegExp(`\\b${subject}\\s+(?:effortlessly\\s+|easily\\s+|simply\\s+)?(?:picked|scooped)\\s+you\\s+up\\b`, "g"),
        (_match, actor: string) => `${actor} tried to lift you, but could not shift your full weight`
      )
      .replace(
        new RegExp(`\\b${subject}\\s+(?:effortlessly\\s+|easily\\s+|simply\\s+)?(?:picks|scoops)\\s+you\\s+up\\b`, "g"),
        (_match, actor: string) => `${actor} tries to lift you, but cannot shift your full weight`
      );
  }
  return rewritten;
}

function resolvePlayerPhysicalCanon(input: {
  persona: string;
  playerMessages: string[];
  persistentContext: string;
}) {
  const persistent = extractPlayerPhysicalCanon([input.persistentContext]);
  const recent = extractPlayerPhysicalCanon(input.playerMessages);
  const persona = extractPlayerPhysicalCanon([input.persona]);

  return {
    heightCentimeters: persona.heightCentimeters ?? recent.heightCentimeters ?? persistent.heightCentimeters,
    weightKilograms: persona.weightKilograms ?? recent.weightKilograms ?? persistent.weightKilograms,
    taller: persona.taller ?? recent.taller ?? persistent.taller,
    heavier: persona.heavier ?? recent.heavier ?? persistent.heavier,
    cannotBeLifted: persona.cannotBeLifted ?? recent.cannotBeLifted ?? persistent.cannotBeLifted
  };
}

function hasPhysicalCanon(canon: PlayerPhysicalCanon) {
  return Boolean(
    canon.heightCentimeters || canon.weightKilograms || canon.taller || canon.heavier || canon.cannotBeLifted
  );
}

function playerAuthoredMessages(sceneContext?: SceneContext) {
  if (!sceneContext) return [];
  return sceneContext.recentMessages
    .filter((message) => message.role.toLowerCase() === "user")
    .map((message) => message.content)
    .concat(sceneContext.currentMessage);
}

function persistentPlayerFacts(value: string) {
  if (!value.trim()) return "";

  const selected: string[] = [];
  let inPhysicalCanon = false;
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "[CANONICAL PLAYER PHYSICAL FACTS]") {
      inPhysicalCanon = true;
      selected.push(trimmed);
      continue;
    }
    if (inPhysicalCanon && !trimmed.startsWith("- ")) inPhysicalCanon = false;
    if (inPhysicalCanon || /^(?:USER|Fact|Identity|User profile|User identity\/context):/i.test(trimmed)) {
      selected.push(trimmed);
    }
  }

  return selected.length ? selected.join("\n") : value;
}

function buildStandingHeightFact(characterName: string, characterHeight: number, playerHeight: number) {
  const difference = Math.round(playerHeight - characterHeight);
  const character = sanitizePromptContext(characterName, 80);
  if (difference > SAME_HEIGHT_TOLERANCE_CM) return `Standing height relation: the player is ${difference} cm taller than ${character}.`;
  if (difference < -SAME_HEIGHT_TOLERANCE_CM) return `Standing height relation: ${character} is ${Math.abs(difference)} cm taller than the player.`;
  return `Standing height relation: ${character} and the player are approximately the same height.`;
}

function buildWeightFact(characterName: string, characterWeight: number, playerWeight: number) {
  const difference = Math.round(playerWeight - characterWeight);
  const character = sanitizePromptContext(characterName, 80);
  if (difference > SAME_WEIGHT_TOLERANCE_KG) return `Body-mass relation: the player is ${difference} kg heavier than ${character}.`;
  if (difference < -SAME_WEIGHT_TOLERANCE_KG) return `Body-mass relation: ${character} is ${Math.abs(difference)} kg heavier than the player.`;
  return `Body-mass relation: ${character} and the player have approximately the same weight.`;
}

function findCanonicalHeight(value: string, subjectName?: string) {
  const normalizedSubject = subjectName?.trim().toLocaleLowerCase();
  const facts = splitExcerpts(value).flatMap((excerpt, order) =>
    parseHeightFacts(excerpt).map((fact) => ({
      ...fact,
      order,
      confidence: fact.confidence + (normalizedSubject && fact.excerpt.toLocaleLowerCase().includes(normalizedSubject) ? 2 : 0)
    }))
  );
  return facts.sort((left, right) => right.confidence - left.confidence || right.order - left.order)[0] ?? null;
}

function parseHeightFacts(excerpt: string): Omit<HeightFact, "order">[] {
  const sanitizedExcerpt = sanitizePromptContext(excerpt, 280);
  const heightLanguage = /\b(?:height|tall|standing|stature)\b|(?:рост|ростом|высок(?:ий|ая|ое|ого|а)?)/i.test(excerpt);
  const facts: Omit<HeightFact, "order">[] = [];

  for (const match of excerpt.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:cm|centimet(?:er|re)s?|см|сантиметр(?:а|ов|ы)?)(?=$|[\s.,;:!?()])/gi)) {
    const centimeters = Number(match[1].replace(",", "."));
    if (isPlausibleHeight(centimeters)) facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: heightLanguage ? 4 : 1 });
  }

  for (const match of excerpt.matchAll(/\b(\d(?:[.,]\d{1,2})?)\s*(?:m|met(?:er|re)s?|м|метр(?:а|ов|ы)?)(?=$|[\s.,;:!?()])/gi)) {
    const centimeters = Number(match[1].replace(",", ".")) * 100;
    if (heightLanguage && isPlausibleHeight(centimeters)) facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: 4 });
  }

  for (const match of excerpt.matchAll(/\b([3-8])\s*(?:ft|feet|')\s*(\d{1,2})?\s*(?:in(?:ches?)?|\")?/gi)) {
    const feet = Number(match[1]);
    const inches = Number(match[2] ?? 0);
    if (inches > 11) continue;
    const centimeters = (feet * 12 + inches) * 2.54;
    if (isPlausibleHeight(centimeters)) facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: heightLanguage ? 4 : 2 });
  }
  return facts;
}

function findCanonicalWeight(value: string, subjectName?: string, assumePlayer = false) {
  const normalizedSubject = subjectName?.trim().toLocaleLowerCase();
  const facts = splitExcerpts(value).flatMap((excerpt, order) =>
    parseWeightFacts(excerpt, assumePlayer).map((fact) => ({
      ...fact,
      order,
      confidence: fact.confidence + (normalizedSubject && fact.excerpt.toLocaleLowerCase().includes(normalizedSubject) ? 2 : 0)
    }))
  );
  return facts.sort((left, right) => right.confidence - left.confidence || right.order - left.order)[0] ?? null;
}

function parseWeightFacts(excerpt: string, assumePlayer: boolean): Omit<WeightFact, "order">[] {
  const sanitizedExcerpt = sanitizePromptContext(excerpt, 280);
  const weightLanguage = /\b(?:weight|weighs?|body mass)\b|(?:вес|весом|вешу|весит|масса)/i.test(excerpt);
  const playerLanguage = /\b(?:user persona|player|i(?:'m| am)?|my)\b|(?:персона|игрок|я|мой|моя|меня)/i.test(excerpt);
  const physicalProfileLanguage = /\b(?:height|tall|standing|stature|build|physique)\b|(?:рост|ростом|высок|телослож)/i.test(excerpt);
  if (!weightLanguage && !assumePlayer) return [];
  const confidence = weightLanguage ? 4 : playerLanguage || physicalProfileLanguage ? 3 : 1;

  const facts: Omit<WeightFact, "order">[] = [];
  for (const match of excerpt.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilograms?|килограмм(?:а|ов|ы)?|кг)(?=$|[\s.,;:!?()])/gi)) {
    const kilograms = Number(match[1].replace(",", "."));
    if (isPlausibleWeight(kilograms)) facts.push({ kilograms, excerpt: sanitizedExcerpt, confidence });
  }
  for (const match of excerpt.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:lb|lbs|pounds?|фунт(?:а|ов|ы)?)(?=$|[\s.,;:!?()])/gi)) {
    const kilograms = Number(match[1].replace(",", ".")) * 0.45359237;
    if (isPlausibleWeight(kilograms)) facts.push({ kilograms, excerpt: sanitizedExcerpt, confidence });
  }
  return facts;
}

function findRelativePhysicalFacts(value: string) {
  return {
    taller: /\b(?:i am|i'm|player is)\s+(?:much\s+)?taller\b|\bmy height is (?:greater|higher|more)\b|(?:я\s+(?:намного\s+)?выше|мой рост (?:больше|выше))/i.test(value),
    heavier: /\b(?:i am|i'm|player is)\s+(?:much\s+)?heavier\b|\bmy weight is (?:greater|higher|more)\b|(?:я\s+(?:намного\s+)?тяжелее|мой вес (?:больше|выше))/i.test(value)
  };
}

function hasCannotBeLiftedConstraint(value: string) {
  return /\b(?:cannot|can't|can not|must not|should not|never)\s+(?:be\s+)?(?:lifted|picked up|carried|hoisted|dragged|moved)\b|\b(?:do not|don't)\s+(?:lift|pick me up|carry|drag|move)\b|(?:меня\s+)?(?:нельзя|невозможно|не\s+можно|не\s+(?:может|могут|сможет|смогут))\s+(?:меня\s+)?(?:поднять|поднимать|приподнять|нести|переносить|утащить|сдвинуть)/i.test(value);
}

function splitExcerpts(value: string) {
  return value.split(/[\r\n]+|(?<=[.!?])\s+/).map((excerpt) => excerpt.trim()).filter(Boolean);
}

function isPlausibleHeight(centimeters: number) {
  return Number.isFinite(centimeters) && centimeters >= 90 && centimeters <= 260;
}

function isPlausibleWeight(kilograms: number) {
  return Number.isFinite(kilograms) && kilograms >= 25 && kilograms <= 500;
}

function formatHeight(centimeters: number) {
  return `${Math.round(centimeters)} cm`;
}

function formatWeight(kilograms: number) {
  return `${Math.round(kilograms)} kg`;
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

function buildQualitativeHeightRule(characterName: string) {
  const character = sanitizePromptContext(characterName, 80);
  return [
    `CANONICAL STANDING RELATION: the player is taller than ${character}.`,
    `- While both stand at the same elevation, ${character} must look up to meet the player's eyes.`,
    "- Do not reverse this relation unless the player explicitly establishes a posture or elevation change."
  ].join("\n");
}

function buildUnknownCounterpartHeightRule(playerHeight: number) {
  return [
    `KNOWN PLAYER HEIGHT: ${formatHeight(playerHeight)}.`,
    "- For every character whose height or explicit height relation to the player is not established, keep the eye line neutral instead of inventing that character as taller or shorter.",
    "- Forbidden for an unspecified-height character at the same elevation: ‘looks down at you’, ‘gazes down at you’, ‘towers over you’, ‘looms over you’, or equivalent narration.",
    "- Use neutral geometry such as ‘looks at you’ or ‘meets your gaze’ until canon or the player establishes a relative height, posture, or elevation."
  ].join("\n");
}

function buildWeightRule(characterName: string, characterWeight: number, playerWeight: number) {
  const difference = Math.round(playerWeight - characterWeight);
  const character = sanitizePromptContext(characterName, 80);
  if (difference > SAME_WEIGHT_TOLERANCE_KG) {
    return `COMPUTED BODY-MASS RELATION: the player is ${difference} kg heavier than ${character}. Do not narrate ${character} moving the player's full body effortlessly.`;
  }
  if (difference < -SAME_WEIGHT_TOLERANCE_KG) {
    return `COMPUTED BODY-MASS RELATION: ${character} is ${Math.abs(difference)} kg heavier than the player. Greater body mass alone does not grant permission or automatic ability to lift, carry, drag, or restrain the player.`;
  }
  return `COMPUTED BODY-MASS RELATION: ${character} and the player have approximately the same weight. Neither can move the other's full body effortlessly by default.`;
}

function buildQualitativeWeightRule(characterName: string) {
  const character = sanitizePromptContext(characterName, 80);
  return `CANONICAL BODY-MASS RELATION: the player is heavier than ${character}. Do not narrate ${character} lifting, carrying, dragging, or repositioning the player effortlessly.`;
}

function buildHandlingRule(characterName: string, cannotBeLifted: boolean) {
  const character = sanitizePromptContext(characterName, 80);
  if (cannotBeLifted) {
    return `CANONICAL HANDLING CONSTRAINT: ${character} cannot lift, carry, hoist, drag, or reposition the player's full body. A decision, command, dominant role, or gender stereotype cannot override this fact.`;
  }
  return [
    `PHYSICAL HANDLING: ${character} deciding to lift or carry the player does not make it physically happen.`,
    "- Require established strength or ability, workable leverage and grip, plausible effort, and compatibility with the canonical body-mass relation.",
    "- Never use gender, dominance, romance, anger, or narrative convenience as proof that the player can be lifted, carried, dragged, restrained, or repositioned."
  ].join("\n");
}

function buildCurrentPostureRule(characterName: string, posture: PlayerPosture | null) {
  const character = sanitizePromptContext(characterName, 80);
  if (posture === "seated" || posture === "lowered" || posture === "lying") {
    return `CURRENT PLAYER POSTURE: the latest player-authored posture is ${posture}. This may change the present eye line, but it remains in force only until the player authors a later posture change.`;
  }
  if (posture === "upright") {
    return `CURRENT PLAYER POSTURE: upright/standing. Apply the computed standing relation now; do not describe ${character} looking down at the player without an explicitly established elevation difference.`;
  }
  return `CURRENT PLAYER POSTURE: no player-authored seated, kneeling, crouched, or lying pose is established. Default to the computed standing relation; do not invent a lower player posture so ${character} can look down at them.`;
}

function resolvePlayerPosture(sceneContext?: SceneContext): PlayerPosture | null {
  if (!sceneContext) return null;
  let posture: PlayerPosture | null = null;
  for (const message of playerAuthoredMessages(sceneContext)) {
    const detected = detectLatestPosture(message);
    if (detected) posture = detected;
  }
  return posture;
}

function detectLatestPosture(value: string): PlayerPosture | null {
  const candidates: Array<{ posture: PlayerPosture; index: number }> = [];
  const patterns: Array<{ posture: PlayerPosture; expressions: RegExp[] }> = [
    {
      posture: "upright",
      expressions: [
        /\b(?:am not|not|isn't|aren't)\s+(?:sitting|seated|kneeling|crouching|lying)\b/gi,
        /\b(?:stand|stands|standing|stood)\b/gi,
        /\b(?:get|gets|got)\s+(?:back\s+)?(?:up|to (?:my|your|their|his|her) feet)\b/gi,
        /\b(?:rise|rises|rose|risen)\b/gi,
        /не\s+(?:сижу|сидит|сидел[аи]?|стою на коленях|лежу)|(?:встал[аи]?|встаю|встает|встала|поднял(?:ся|ась)|поднимаюсь|стою|стоишь|на ногах)/gi
      ]
    },
    {
      posture: "seated",
      expressions: [
        /\b(?:sit|sits|sitting|sat|seated)\b/gi,
        /(?:сел[аи]?|сажусь|сижу|сидит|сидел[аи]?)/gi
      ]
    },
    {
      posture: "lowered",
      expressions: [
        /\b(?:kneel|kneels|kneeling|knelt|crouch|crouches|crouching|crouched)\b/gi,
        /(?:встал[аи]? на колени|стою на коленях|опустил(?:ся|ась) на колени|присел[аи]? на корточки|на корточках)/gi
      ]
    },
    {
      posture: "lying",
      expressions: [
        /\b(?:lie|lies|lying|lay down|laid down)\b/gi,
        /(?:легл[аи]?|ложусь|лежу|лежит)/gi
      ]
    }
  ];

  for (const { posture, expressions } of patterns) {
    for (const expression of expressions) {
      for (const match of value.matchAll(expression)) {
        candidates.push({ posture, index: (match.index ?? 0) + match[0].length });
      }
    }
  }
  return candidates.sort((left, right) => right.index - left.index)[0]?.posture ?? null;
}

function hasPlayerAuthoredElevationOffset(sceneContext: SceneContext) {
  return playerAuthoredMessages(sceneContext)
    .slice(-4)
    .some((message) => /\b(?:i(?:'m| am| stand| wait| remain)?\s+(?:below|beneath|downhill from)|at the (?:bottom|foot) of|above me|overhead)\b|(?:я\s+(?:стою\s+)?ниже|надо мной|у подножия|внизу)/i.test(message));
}
