export type PersonaDraft = {
  profileId?: string;
  label: string;
  displayName: string;
  surname: string;
  avatarUrl: string;
  appearance: string;
  summary: string;
  background: string;
  traits: string;
  likes: string;
  dislikes: string;
  boundaries: string;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
};

export type PersonaProfile = PersonaDraft & { id: string; isDefault: boolean };

export const emptyPersonaDraft: PersonaDraft = {
  label: "",
  displayName: "",
  surname: "",
  avatarUrl: "",
  appearance: "",
  summary: "",
  background: "",
  traits: "",
  likes: "",
  dislikes: "",
  boundaries: "",
  visibility: "PRIVATE"
};

export function personaEditorLines(value: string) {
  return value
    .split(/[\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function personaDraftPayload(draft: PersonaDraft) {
  return {
    profileId: draft.profileId,
    label: draft.label.trim() || draft.displayName.trim(),
    displayName: draft.displayName.trim(),
    surname: draft.surname.trim(),
    avatarUrl: draft.avatarUrl,
    appearance: draft.appearance.trim(),
    summary: draft.summary.trim(),
    background: draft.background,
    traits: personaEditorLines(draft.traits),
    likes: personaEditorLines(draft.likes),
    dislikes: personaEditorLines(draft.dislikes),
    boundaries: personaEditorLines(draft.boundaries),
    visibility: draft.visibility
  };
}

export function personaProfileFromApi(profile: Record<string, unknown>): PersonaProfile {
  const listText = (value: unknown) => (Array.isArray(value) ? value.join("\n") : "");
  return {
    id: String(profile.id ?? "default"),
    profileId: String(profile.id ?? "default"),
    label: String(profile.label ?? profile.displayName ?? "Persona"),
    displayName: String(profile.displayName ?? ""),
    surname: String(profile.surname ?? ""),
    avatarUrl: String(profile.avatarUrl ?? ""),
    appearance: String(profile.appearance ?? ""),
    summary: String(profile.summary ?? ""),
    background: String(profile.background ?? ""),
    traits: listText(profile.traits),
    likes: listText(profile.likes),
    dislikes: listText(profile.dislikes),
    boundaries: listText(profile.boundaries),
    isDefault: profile.isDefault === true,
    visibility: profile.visibility === "PUBLIC" || profile.visibility === "UNLISTED" ? profile.visibility : "PRIVATE"
  };
}
