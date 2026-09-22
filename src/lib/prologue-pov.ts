import { canonicalCharacterName, renderCharacterTemplate } from "@/lib/character-prompt-contract";

export type ProloguePov = "second" | "third";

export function normalizeProloguePov(value: unknown): ProloguePov {
  return value === "third" ? "third" : "second";
}

export function prologuePovInstruction(value: unknown) {
  const perspective =
    normalizeProloguePov(value) === "third"
      ? "Write narration in third person. Refer to the player's persona with the exact {{user}} placeholder in narration; do not narrate the player's thoughts, feelings, decisions, dialogue, or unprovided actions. Dialogue may address them naturally as 'you'."
      : "Write narration in second person and address the player as 'you'; do not narrate the player's thoughts, feelings, decisions, dialogue, or unprovided actions.";
  return `${perspective} The selected point of view takes precedence over conflicting narration in reference text or an earlier greeting. The {{user}} placeholder always means the player's name, never a second-person pronoun. In second-person narration, write 'you' directly (or the equivalent in the output language); use {{user}} when a name is intended, including in dialogue. Never call the player 'the user', 'user', 'the player', 'юзер', or 'пользователь' in story prose or dialogue; these are application labels, not in-world identities.`;
}

export function renderCharacterPrologue(input: {
  greeting: string;
  characterName: string;
  communicationStyle?: unknown;
  userPersonaName?: string | null;
  userPersonaSurname?: string | null;
}) {
  const style = asRecord(input.communicationStyle);
  const pov = normalizeProloguePov(style?.prologuePov);
  return renderCharacterTemplate(input.greeting, {
    characterName: canonicalCharacterName(input.characterName),
    userName: input.userPersonaName?.trim() || (pov === "third" ? "the newcomer" : "you"),
    userSurname: input.userPersonaSurname?.trim() || ""
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
