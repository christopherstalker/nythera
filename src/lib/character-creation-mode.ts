import { generateSimpleCharacterDraft } from "@/lib/simple-character-generation";
import type { CharacterCreationMode } from "@/lib/character-form-types";

type LegacyCharacterShape = {
  name: string;
  description: string;
  personality: string;
  scenario?: string | null;
  persona?: unknown;
};

export function inferLegacyCharacterCreationMode(character: LegacyCharacterShape): CharacterCreationMode {
  const generated = generateSimpleCharacterDraft({
    name: character.name,
    description: character.description
  });
  const persona = isRecord(character.persona) ? character.persona : {};

  return character.personality === generated.personality &&
    character.scenario === generated.scenario &&
    persona.archetype === generated.archetype
    ? "simple"
    : "custom";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
