import type { UserPersona, Visibility } from "@prisma/client";

export type UserPersonaProfile = {
  id: string;
  label: string;
  displayName: string;
  avatarUrl: string | null;
  summary: string;
  background: string | null;
  traits: string[];
  likes: string[];
  dislikes: string[];
  boundaries: string[];
  visibility: Visibility;
};

type PersonaLike = Pick<
  UserPersona,
  "displayName" | "avatarUrl" | "summary" | "background" | "traits" | "likes" | "dislikes" | "boundaries" | "visibility" | "metadata"
>;

type PersonaMetadata = {
  activeProfileId?: string;
  profiles?: UserPersonaProfile[];
};

export function normalizePersonaProfiles(persona?: PersonaLike | null) {
  if (!persona) {
    return {
      profiles: [] as UserPersonaProfile[],
      activeProfileId: null as string | null,
      activeProfile: null as UserPersonaProfile | null
    };
  }

  const metadata = parsePersonaMetadata(persona.metadata);
  const canonical = personaToProfile(persona);
  const metadataProfiles = mergeProfiles(metadata.profiles ?? []);
  const profiles = metadataProfiles.length ? metadataProfiles : [canonical];
  const activeProfileId = profiles.some((profile) => profile.id === metadata.activeProfileId)
    ? metadata.activeProfileId ?? profiles[0]?.id ?? null
    : profiles[0]?.id ?? null;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;

  return { profiles, activeProfileId, activeProfile };
}

export function personaToProfile(persona: Omit<PersonaLike, "metadata">): UserPersonaProfile {
  return {
    id: "default",
    label: persona.displayName || "Default",
    displayName: persona.displayName,
    avatarUrl: persona.avatarUrl ?? null,
    summary: persona.summary,
    background: persona.background ?? null,
    traits: persona.traits ?? [],
    likes: persona.likes ?? [],
    dislikes: persona.dislikes ?? [],
    boundaries: persona.boundaries ?? [],
    visibility: persona.visibility
  };
}

export function buildPersonaMetadata(profiles: UserPersonaProfile[], activeProfileId: string): PersonaMetadata {
  return {
    activeProfileId,
    profiles: mergeProfiles(profiles).map((profile) => ({
      ...profile,
      label: profile.label.trim() || profile.displayName
    }))
  };
}

export function createPersonaProfileId() {
  return `persona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePersonaMetadata(value: unknown): PersonaMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const profiles = Array.isArray(record.profiles)
    ? record.profiles.map(parseProfile).filter((profile): profile is UserPersonaProfile => Boolean(profile))
    : undefined;
  const activeProfileId = typeof record.activeProfileId === "string" ? record.activeProfileId : undefined;

  return { activeProfileId, profiles };
}

function parseProfile(value: unknown): UserPersonaProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  const displayName = typeof record.displayName === "string" && record.displayName.trim() ? record.displayName.trim() : null;
  const summary = typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : null;

  if (!id || !displayName || !summary) {
    return null;
  }

  return {
    id,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : displayName,
    displayName,
    avatarUrl: typeof record.avatarUrl === "string" && record.avatarUrl.trim() ? record.avatarUrl.trim() : null,
    summary,
    background: typeof record.background === "string" && record.background.trim() ? record.background.trim() : null,
    traits: parseList(record.traits),
    likes: parseList(record.likes),
    dislikes: parseList(record.dislikes),
    boundaries: parseList(record.boundaries),
    visibility: isVisibility(record.visibility) ? record.visibility : "PRIVATE"
  };
}

export function mergeProfiles(profiles: UserPersonaProfile[]) {
  const byId = new Map<string, UserPersonaProfile>();
  for (const profile of profiles) {
    byId.set(profile.id, {
      ...profile,
      traits: profile.traits.slice(0, 24),
      likes: profile.likes.slice(0, 24),
      dislikes: profile.dislikes.slice(0, 24),
      boundaries: profile.boundaries.slice(0, 24)
    });
  }

  return Array.from(byId.values()).slice(0, 12);
}

function parseList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 24) : [];
}

function isVisibility(value: unknown): value is Visibility {
  return value === "PRIVATE" || value === "PUBLIC" || value === "UNLISTED";
}
