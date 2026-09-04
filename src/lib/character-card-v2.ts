type UnknownRecord = Record<string, unknown>;

export type ParsedCharacterCardV2 = {
  data: UnknownRecord;
  notes: {
    persona?: UnknownRecord;
    communicationStyle?: UnknownRecord;
    lorebook?: UnknownRecord;
    visualIdentity?: UnknownRecord;
  };
};

export function parseCharacterCardV2Json(value: string): ParsedCharacterCardV2 {
  const parsed = JSON.parse(value) as unknown;
  const root = asRecord(parsed);
  if (!root) {
    throw new Error("Not a Character Card V2 document.");
  }
  const data = asRecord(root.data) ?? root;

  if (!data || !isCharacterCardData(data)) {
    throw new Error("Not a Character Card V2 document.");
  }

  return {
    data,
    notes: parseCreatorNotes(data.creator_notes)
  };
}

export function isCharacterCardV2Json(value: string) {
  try {
    parseCharacterCardV2Json(value);
    return true;
  } catch {
    return false;
  }
}

function isCharacterCardData(value: UnknownRecord) {
  return (
    typeof value.name === "string" &&
    (typeof value.personality === "string" ||
      typeof value.description === "string" ||
      typeof value.first_mes === "string" ||
      typeof value.mes_example === "string")
  );
}

function parseCreatorNotes(value: unknown): ParsedCharacterCardV2["notes"] {
  const parsed =
    typeof value === "string" && value.trim()
      ? safeJsonParse(value)
      : value;
  const notes = asRecord(parsed);

  if (!notes) {
    return {};
  }

  return {
    persona: asRecord(notes.persona) ?? undefined,
    communicationStyle: asRecord(notes.communicationStyle) ?? undefined,
    lorebook: asRecord(notes.lorebook) ?? undefined,
    visualIdentity: asRecord(notes.visualIdentity) ?? undefined
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}
