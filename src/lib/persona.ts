import "server-only";

import type { CharacterPersona } from "@/types";

type PersonaCharacter = {
  name: string;
  description: string;
  personality: string;
  scenario?: string | null;
  greeting: string;
  communicationStyle?: unknown;
  persona?: unknown;
};

const RELATIONSHIP_STYLES = new Set(["friend", "romantic", "mentor", "rival"]);
const VERBOSITY_LEVELS = new Set(["concise", "balanced", "expressive", "immersive"]);

export function resolveCharacterPersona(character: PersonaCharacter): Required<CharacterPersona> {
  const parsed = parsePersona(character.persona);
  const style = parseCommunicationStyle(character.communicationStyle);

  return {
    name: parsed.name || character.name,
    role: parsed.role || character.description,
    personalityTraits: normalizeList(parsed.personalityTraits, character.personality),
    speakingStyle:
      parsed.speakingStyle ||
      style.tone ||
      "Speak naturally, with a consistent point of view and scene-aware details.",
    emotionalTone: parsed.emotionalTone || style.tone || "warm, attentive, and immersive",
    boundaries: normalizeList(parsed.boundaries, "Keep the interaction safe, fictional, consensual, and respectful."),
    motivation:
      parsed.motivation ||
      "Create emotionally coherent conversations while preserving continuity, user preferences, and the current scene.",
    behavioralRules: normalizeList(
      parsed.behavioralRules,
      "Stay in character; avoid generic assistant phrasing; ask scene-forward questions when useful."
    ),
    verbosityLevel: VERBOSITY_LEVELS.has(parsed.verbosityLevel ?? "")
      ? parsed.verbosityLevel!
      : style.messageLength === "long"
        ? "immersive"
        : style.messageLength === "short"
          ? "concise"
          : "balanced",
    relationshipStyle: RELATIONSHIP_STYLES.has(parsed.relationshipStyle ?? "") ? parsed.relationshipStyle! : "friend"
  };
}

export function formatPersonaBlock(persona: Required<CharacterPersona>) {
  return [
    "CHARACTER PERSONA - AUTHORITATIVE IDENTITY",
    `Name: ${persona.name}`,
    `Role: ${persona.role}`,
    `Relationship style: ${persona.relationshipStyle}`,
    `Verbosity level: ${persona.verbosityLevel}`,
    `Personality traits: ${persona.personalityTraits.join(", ")}`,
    `Speaking style: ${persona.speakingStyle}`,
    `Emotional tone: ${persona.emotionalTone}`,
    `Motivation: ${persona.motivation}`,
    "Boundaries:",
    ...persona.boundaries.map((item) => `- ${item}`),
    "Behavioral rules:",
    ...persona.behavioralRules.map((item) => `- ${item}`),
    "",
    "This persona overrides generic model behavior. Never drift into a neutral assistant voice unless safety requires it."
  ].join("\n");
}

function parsePersona(value: unknown): CharacterPersona {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    name: stringValue(record.name),
    role: stringValue(record.role),
    personalityTraits: arrayValue(record.personalityTraits),
    speakingStyle: stringValue(record.speakingStyle),
    emotionalTone: stringValue(record.emotionalTone),
    boundaries: arrayValue(record.boundaries),
    motivation: stringValue(record.motivation),
    behavioralRules: arrayValue(record.behavioralRules),
    verbosityLevel: stringValue(record.verbosityLevel) as CharacterPersona["verbosityLevel"],
    relationshipStyle: stringValue(record.relationshipStyle) as CharacterPersona["relationshipStyle"]
  };
}

function parseCommunicationStyle(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    tone: stringValue(record.tone),
    messageLength: stringValue(record.messageLength)
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function arrayValue(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 16);
}

function normalizeList(value: string[] | undefined, fallback: string) {
  if (value?.length) {
    return value;
  }

  return fallback
    .split(/[.;]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}
