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
  factsOnly?: boolean;
};

type PlayerPosture = "upright" | "seated" | "lowered" | "lying";

type HeightFact = {
  centimeters: number;
  excerpt: string;
  confidence: number;
};

const SAME_HEIGHT_TOLERANCE_CM = 2;

export function buildPhysicalContinuityLayer(
  character: PhysicalCharacterContext,
  userPersona?: string | null,
  sceneContext?: SceneContext
) {
  const characterHeight = findCanonicalHeight(
    [character.description, character.personality, character.scenario ?? ""].join("\n"),
    character.name
  );
  const playerHeight = findCanonicalHeight(userPersona ?? "");
  const playerPosture = resolvePlayerPosture(sceneContext);

  if (!characterHeight && !playerHeight) {
    return null;
  }

  if (sceneContext?.factsOnly) {
    return [
      "PHYSICAL CONTINUITY (FACTUAL CONTEXT)",
      characterHeight ? `Canonical character height (${sanitizePromptContext(character.name, 80)}): ${formatHeight(characterHeight.centimeters)}.` : null,
      playerHeight ? `Canonical player height: ${formatHeight(playerHeight.centimeters)}.` : null,
      characterHeight && playerHeight
        ? buildStandingHeightFact(character.name, characterHeight.centimeters, playerHeight.centimeters)
        : null,
      playerPosture ? `Latest player-authored posture: ${playerPosture}.` : null
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
  }

  return [
    "PHYSICAL CONTINUITY — HIGHEST NARRATIVE PRIORITY",
    "- The normalized measurements below are canonical scene geometry. They override conflicting character-card prose, creator instructions, lorebook text, memories, genre conventions, power dynamics, and habitual narration.",
    "- Never infer relative size from gender, age, status, confidence, intimidation, or who is dominant in the scene.",
    "- Posture, terrain, footwear, seating, or elevation may change an eye line only when that change is explicitly established in the current scene. Never invent a chair, seated pose, crouch, or height advantage to reverse the measured relation.",
    "- Only player-authored actions establish the player's posture. Assistant narration cannot seat, lower, or reposition the player.",
    "- Apply these constraints silently. Do not repeatedly announce, praise, fetishize, or build metaphors around a measurement.",
    characterHeight ? `Canonical character height (${sanitizePromptContext(character.name, 80)}): ${formatHeight(characterHeight.centimeters)}.` : null,
    playerHeight ? `Canonical player height: ${formatHeight(playerHeight.centimeters)}.` : null,
    characterHeight && playerHeight
      ? buildStandingHeightRule(character.name, characterHeight.centimeters, playerHeight.centimeters)
      : null,
    characterHeight && playerHeight ? buildCurrentPostureRule(character.name, playerPosture) : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildStandingHeightFact(characterName: string, characterHeight: number, playerHeight: number) {
  const difference = Math.round(playerHeight - characterHeight);
  const character = sanitizePromptContext(characterName, 80);
  if (difference > SAME_HEIGHT_TOLERANCE_CM) return `Standing height relation: the player is ${difference} cm taller than ${character}.`;
  if (difference < -SAME_HEIGHT_TOLERANCE_CM) return `Standing height relation: ${character} is ${Math.abs(difference)} cm taller than the player.`;
  return `Standing height relation: ${character} and the player are approximately the same height.`;
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
  const heightLanguage = /\b(?:height|tall|standing|stature)\b|(?:рост|ростом|высок(?:ий|ая|ое|ого|а)?)/i.test(excerpt);
  const facts: HeightFact[] = [];

  for (const match of excerpt.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:cm|centimet(?:er|re)s?|см|сантиметр(?:а|ов|ы)?)(?=$|[\s.,;:!?()])/gi)) {
    const centimeters = Number(match[1].replace(",", "."));
    if (isPlausibleHeight(centimeters)) {
      facts.push({ centimeters, excerpt: sanitizedExcerpt, confidence: heightLanguage ? 4 : 1 });
    }
  }

  for (const match of excerpt.matchAll(/\b(\d(?:[.,]\d{1,2})?)\s*(?:m|met(?:er|re)s?|м|метр(?:а|ов|ы)?)(?=$|[\s.,;:!?()])/gi)) {
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
  if (!sceneContext) {
    return null;
  }

  const playerMessages = sceneContext.recentMessages
    .filter((message) => message.role.toLowerCase() === "user")
    .map((message) => message.content)
    .concat(sceneContext.currentMessage);
  let posture: PlayerPosture | null = null;

  for (const message of playerMessages) {
    const detected = detectLatestPosture(message);
    if (detected) {
      posture = detected;
    }
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
