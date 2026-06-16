"use client";

import { FormEvent, useEffect, useState } from "react";

export type PersonaProfile = {
  id: string;
  label: string;
  displayName: string;
  avatarUrl?: string | null;
  summary: string;
  background?: string | null;
  traits: string[];
  likes: string[];
  dislikes: string[];
  boundaries: string[];
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
};

export type PersonaDraft = {
  profileId?: string;
  label: string;
  displayName: string;
  avatarUrl: string;
  summary: string;
  background: string;
  traits: string;
  likes: string;
  dislikes: string;
  boundaries: string;
};

export type MemoryRow = {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  character?: { name: string } | null;
};

export type ChatPreview = {
  id: string;
  title?: string | null;
  character: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string }>;
};

export const emptyPersonaDraft: PersonaDraft = {
  label: "",
  displayName: "",
  avatarUrl: "",
  summary: "",
  background: "",
  traits: "",
  likes: "",
  dislikes: "",
  boundaries: ""
};

type UseChatQuickPanelOptions = {
  chatId: string;
  characterId?: string | null;
  enabled?: boolean;
};

export function useChatQuickPanel({ chatId, characterId, enabled = true }: UseChatQuickPanelOptions) {
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaProfile | null>(null);
  const [draft, setDraft] = useState<PersonaDraft>(emptyPersonaDraft);
  const [personaStatus, setPersonaStatus] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function loadInitialData() {
      const memoryParams = new URLSearchParams({ take: "8" });
      if (characterId) {
        memoryParams.set("characterId", characterId);
      }

      const [personaResponse, memoriesResponse, chatsResponse] = await Promise.allSettled([
        fetch("/api/user-persona", { cache: "no-store", signal }),
        fetch(`/api/memories?${memoryParams.toString()}`, { cache: "no-store", signal }),
        fetch("/api/chats", { cache: "no-store", signal })
      ]);

      if (personaResponse.status === "fulfilled" && personaResponse.value.ok) {
        const body = await personaResponse.value.json();
        const nextProfiles = Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : [];
        const active = body.activeProfile ? profileFromApi(body.activeProfile) : nextProfiles[0] ?? null;
        setProfiles(nextProfiles);
        setActiveProfileId(body.activeProfileId ?? nextProfiles[0]?.id ?? null);
        setActivePersona(active);
        if (body.activeProfile) {
          setDraft(profileToDraft(body.activeProfile));
        }
      }

      if (memoriesResponse.status === "fulfilled" && memoriesResponse.value.ok) {
        const body = await memoriesResponse.value.json();
        setMemories(Array.isArray(body.memories) ? body.memories : []);
      }

      if (chatsResponse.status === "fulfilled" && chatsResponse.value.ok) {
        const body = await chatsResponse.value.json();
        setChats(Array.isArray(body.chats) ? body.chats.slice(0, 8) : []);
      }
    }

    void loadInitialData().catch(() => undefined);

    return () => controller.abort();
  }, [chatId, characterId, enabled]);

  async function loadMemories(signal?: AbortSignal) {
    const params = new URLSearchParams({ take: "8" });
    if (characterId) {
      params.set("characterId", characterId);
    }

    const response = await fetch(`/api/memories?${params.toString()}`, { cache: "no-store", signal });
    if (!response.ok) {
      return;
    }

    const body = await response.json();
    setMemories(Array.isArray(body.memories) ? body.memories : []);
  }

  function updateDraft<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function pickAvatar(dataUrl: string) {
    updateDraft("avatarUrl", dataUrl);
    setPersonaStatus(null);
  }

  function setAvatarPickError(message: string) {
    setPersonaStatus(message);
  }

  function setAvatarUploadingState(uploading: boolean) {
    setAvatarUploading(uploading);
  }

  async function switchPersona(profile: PersonaProfile) {
    setActiveProfileId(profile.id);
    setActivePersona(profile);
    setDraft(profileToDraft(profile));
    setPersonaStatus(null);

    const response = await fetch("/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activeProfileId: profile.id })
    });

    setPersonaStatus(response.ok ? "Active persona updated." : "Could not switch persona.");
  }

  async function savePersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.displayName.trim() || !draft.summary.trim()) {
      return;
    }

    const response = await fetch("/api/user-persona", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: draft.profileId,
        label: draft.label || draft.displayName,
        displayName: draft.displayName,
        avatarUrl: draft.avatarUrl,
        summary: draft.summary,
        background: draft.background,
        traits: parseLines(draft.traits),
        likes: parseLines(draft.likes),
        dislikes: parseLines(draft.dislikes),
        boundaries: parseLines(draft.boundaries),
        visibility: "PRIVATE"
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setPersonaStatus(body?.error ?? "Could not save persona.");
      return;
    }

    const body = await response.json();
    const nextActive = body.activeProfile ? profileFromApi(body.activeProfile) : null;
    setPersonaStatus("Persona saved for the next message.");
    setProfiles(Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : []);
    setActiveProfileId(body.activeProfileId ?? null);
    setActivePersona(nextActive);
    if (body.activeProfile) {
      setDraft(profileToDraft(body.activeProfile));
    }
  }

  async function addMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memoryDraft.trim()) {
      return;
    }

    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: memoryDraft,
        characterId: characterId ?? null,
        category: "FACT",
        importance: 2,
        pinned: true
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMemoryStatus(body?.error ?? "Could not save memory.");
      return;
    }

    setMemoryDraft("");
    setMemoryStatus("Memory added to context.");
    await loadMemories();
  }

  function startNewPersona() {
    setDraft({ ...emptyPersonaDraft, label: "New persona" });
    setActiveProfileId(null);
    setActivePersona(null);
    setPersonaStatus(null);
  }

  return {
    profiles,
    activeProfileId,
    activePersona,
    draft,
    personaStatus,
    memoryDraft,
    memoryStatus,
    memories,
    chats,
    avatarUploading,
    setMemoryDraft,
    updateDraft,
    pickAvatar,
    setAvatarPickError,
    setAvatarUploadingState,
    switchPersona,
    savePersona,
    addMemory,
    startNewPersona
  };
}

export function profileFromApi(profile: Record<string, unknown>): PersonaProfile {
  return {
    id: String(profile.id ?? "default"),
    label: String(profile.label ?? profile.displayName ?? "Persona"),
    displayName: String(profile.displayName ?? ""),
    avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
    summary: String(profile.summary ?? ""),
    background: typeof profile.background === "string" ? profile.background : "",
    traits: Array.isArray(profile.traits) ? profile.traits.filter((item): item is string => typeof item === "string") : [],
    likes: Array.isArray(profile.likes) ? profile.likes.filter((item): item is string => typeof item === "string") : [],
    dislikes: Array.isArray(profile.dislikes) ? profile.dislikes.filter((item): item is string => typeof item === "string") : [],
    boundaries: Array.isArray(profile.boundaries) ? profile.boundaries.filter((item): item is string => typeof item === "string") : [],
    visibility: profile.visibility === "PUBLIC" || profile.visibility === "UNLISTED" ? profile.visibility : "PRIVATE"
  };
}

export function profileToDraft(profile: Record<string, unknown>): PersonaDraft {
  const parsed = profileFromApi(profile);
  return {
    profileId: parsed.id,
    label: parsed.label,
    displayName: parsed.displayName,
    avatarUrl: parsed.avatarUrl ?? "",
    summary: parsed.summary,
    background: parsed.background ?? "",
    traits: parsed.traits.join("\n"),
    likes: parsed.likes.join("\n"),
    dislikes: parsed.dislikes.join("\n"),
    boundaries: parsed.boundaries.join("\n")
  };
}

function parseLines(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}
