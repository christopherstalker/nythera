import { renderCharacterTemplate } from "@/lib/character-prompt-contract";

export type ProloguePov = "second" | "third";

export function normalizeProloguePov(value: unknown): ProloguePov {
  return value === "third" ? "third" : "second";
}

export function prologuePovInstruction(value: unknown) {
  return normalizeProloguePov(value) === "third"
    ? "Write narration in third person. Refer to the player's persona with the exact {{user}} placeholder in narration; do not narrate the player's thoughts, feelings, decisions, dialogue, or unprovided actions. Dialogue may address them naturally as 'you'."
    : "Write narration in second person and address the player as 'you'; do not narrate the player's thoughts, feelings, decisions, dialogue, or unprovided actions.";
}

export function renderCharacterPrologue(input: {
  greeting: string;
  characterName: string;
  communicationStyle?: unknown;
  userPersonaName?: string | null;
}) {
  const style = asRecord(input.communicationStyle);
  const pov = normalizeProloguePov(style?.prologuePov);
  return renderCharacterTemplate(input.greeting, {
    characterName: input.characterName,
    userName: pov === "third" ? input.userPersonaName?.trim() || "the newcomer" : "you"
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
