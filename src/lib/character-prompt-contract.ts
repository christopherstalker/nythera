import type { Prisma } from "@prisma/client";

type CharacterIdentityInput = {
  name: string;
  personality?: string | null;
  scenario?: string | null;
  persona?: unknown;
};

export function canonicalCharacterName(value: string) {
  const trimmed = value.trim();
  return trimmed.split(/\s+\|\s+/, 1)[0]?.trim() || trimmed;
}

export function canonicalizeCharacterPersona(characterName: string, persona: unknown): Prisma.JsonValue | undefined {
  if (persona === undefined) {
    return undefined;
  }
  if (!persona || typeof persona !== "object" || Array.isArray(persona)) {
    return persona as Prisma.JsonValue;
  }

  return {
    ...(persona as Record<string, unknown>),
    name: canonicalCharacterName(characterName)
  } as Prisma.JsonObject;
}

export function extractUserPersonaName(value?: string | null) {
  const match = value?.match(/^User persona name:\s*(.+)$/im);
  return match?.[1]?.trim() || "the user";
}

export function renderCharacterTemplate(
  value: string,
  context: { characterName: string; userName: string }
) {
  return value
    .replace(/\{\{\s*(?:char|character)\s*\}\}/gi, context.characterName)
    .replace(/\{\{\s*user\s*\}\}/gi, context.userName);
}

export function findCharacterIdentityConflicts(character: CharacterIdentityInput) {
  const canonicalName = canonicalCharacterName(character.name);
  const candidates: Array<{ source: string; value?: string }> = [];

  if (character.persona && typeof character.persona === "object" && !Array.isArray(character.persona)) {
    const personaName = (character.persona as Record<string, unknown>).name;
    candidates.push({ source: "persona.name", value: typeof personaName === "string" ? personaName : undefined });
  }

  candidates.push({
    source: "personality heading",
    value: character.personality?.match(/^\s*Personality\s*:\s*([^\r\n]+)/i)?.[1]?.trim()
  });
  candidates.push({
    source: "scenario subject",
    value: character.scenario?.match(/\bbuilt around\s+(.+?)(?:'s\s+central premise|\s*\|)/i)?.[1]?.trim()
  });

  return candidates
    .filter((candidate): candidate is { source: string; value: string } => Boolean(candidate.value))
    .filter((candidate) => !namesOverlap(canonicalName, candidate.value));
}

function namesOverlap(left: string, right: string) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  return Boolean(normalizedLeft && normalizedRight) &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft));
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\p{L}]+/gu, " ")
    .trim();
}
