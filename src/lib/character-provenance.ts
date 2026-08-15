export const CHARACTER_ORIGIN_TYPES = [
  "ORIGINAL",
  "PUBLIC_DOMAIN",
  "LICENSED",
  "FAN_INTERPRETATION",
  "REAL_PERSON",
  "HISTORICAL_FIGURE"
] as const;

export type CharacterOriginType = (typeof CHARACTER_ORIGIN_TYPES)[number];

export type CharacterProvenance = {
  originType?: CharacterOriginType | null;
  sourceLabel?: string | null;
  isRealPerson?: boolean | null;
  aiDisclosure?: boolean | null;
};

export function characterDisclosure(character: CharacterProvenance) {
  if (character.originType === "REAL_PERSON" || character.isRealPerson) {
    return {
      label: "Unofficial AI portrayal",
      detail:
        "This is an AI-generated roleplay interpretation, not the real person. It is not an official account, affiliation, or endorsement."
    };
  }

  if (character.originType === "FAN_INTERPRETATION") {
    return {
      label: "Unofficial AI fan character",
      detail:
        "This is an AI-generated fan interpretation for fictional roleplay. It is not official or endorsed by the source rights holder."
    };
  }

  return {
    label: "AI character",
    detail: "This is an AI-generated roleplay character, not a real person."
  };
}
