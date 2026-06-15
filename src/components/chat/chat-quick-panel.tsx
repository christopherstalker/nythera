"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Brain, Check, ImagePlus, MessageSquare, Plus, Upload, UserRound, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PersonaProfile = {
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

type PersonaDraft = {
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

type MemoryRow = {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  character?: { name: string } | null;
};

type ChatPreview = {
  id: string;
  title?: string | null;
  character: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string }>;
};

type ChatQuickPanelProps = {
  chatId: string;
  characterId?: string | null;
  open: boolean;
  onClose: () => void;
};

const tabs = [
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "history", label: "Chats", icon: MessageSquare }
] as const;

const emptyDraft: PersonaDraft = {
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

export function ChatQuickPanel({ chatId, characterId, open, onClose }: ChatQuickPanelProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("persona");
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonaDraft>(emptyDraft);
  const [personaStatus, setPersonaStatus] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);

  useEffect(() => {
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
        setProfiles(nextProfiles);
        setActiveProfileId(body.activeProfileId ?? nextProfiles[0]?.id ?? null);
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
  }, [chatId, characterId]);

  const panelTitle = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label ?? "Quick panel", [activeTab]);

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

  function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPersonaStatus("Choose an image file.");
      return;
    }

    if (file.size > 1_500_000) {
      setPersonaStatus("Persona photo must be smaller than 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateDraft("avatarUrl", String(reader.result ?? ""));
      setPersonaStatus(null);
    };
    reader.onerror = () => setPersonaStatus("Could not read persona photo.");
    reader.readAsDataURL(file);
  }

  async function switchPersona(profile: PersonaProfile) {
    setActiveProfileId(profile.id);
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
    setPersonaStatus("Persona saved for the next message.");
    setProfiles(Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : []);
    setActiveProfileId(body.activeProfileId ?? null);
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

  if (!open) {
    return null;
  }

  return (
    <aside className="quick-panel fixed inset-x-3 bottom-3 top-20 z-40 flex flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] backdrop-blur-2xl md:bottom-4 md:left-auto md:right-4 md:top-24 md:w-[360px] xl:static xl:h-full xl:w-[340px] xl:shrink-0">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{panelTitle}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">Persona, memory, recent chats</p>
        </div>
        <button type="button" aria-label="Close quick panel" onClick={onClose} className="focus-ring grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] hover:bg-white/[0.055]">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-1 border-b border-[var(--border-subtle)] p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "focus-ring flex h-10 items-center justify-center gap-1.5 rounded-2xl text-xs font-medium transition-colors",
                active ? "bg-[var(--accent-purple-soft)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "persona" ? (
          <div className="grid gap-3">
            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void switchPersona(profile)}
                  className={cn(
                    "focus-ring flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 text-left text-xs transition-colors",
                    activeProfileId === profile.id ? "border-transparent bg-[var(--accent-purple-soft)] text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)]"
                  )}
                >
                  <Avatar name={profile.displayName} src={profile.avatarUrl} size="xs" />
                  <span className="max-w-28 truncate">{profile.label || profile.displayName}</span>
                  {activeProfileId === profile.id ? <Check className="h-3.5 w-3.5 text-[var(--accent-purple)]" /> : null}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...emptyDraft, label: "New persona" });
                  setActiveProfileId(null);
                }}
                className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                aria-label="Add persona"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={savePersona} className="grid gap-2">
              <Input value={draft.label} onChange={(event) => updateDraft("label", event.target.value)} placeholder="Profile label" />
              <Input value={draft.displayName} onChange={(event) => updateDraft("displayName", event.target.value)} placeholder="Your roleplay name" required />
              <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                <label className="focus-ring grid h-[72px] cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)] backdrop-blur-xl transition hover:border-[var(--accent-purple)] hover:bg-white/[0.045]">
                  {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5" />}
                  <input type="file" accept="image/*" className="sr-only" onChange={onAvatarFile} />
                </label>
                <div className="grid content-center gap-2">
                  <Input value={draft.avatarUrl} onChange={(event) => updateDraft("avatarUrl", event.target.value)} placeholder="Avatar URL or upload" />
                  {draft.avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => updateDraft("avatarUrl", "")}
                      className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      Clear photo
                    </button>
                  ) : null}
                </div>
              </div>
              <Textarea value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} placeholder="Who you are in this chat." required className="min-h-20" />
              <Textarea value={draft.background} onChange={(event) => updateDraft("background", event.target.value)} placeholder="Background or current situation." className="min-h-20" />
              <Textarea value={draft.traits} onChange={(event) => updateDraft("traits", event.target.value)} placeholder="Traits, one per line" className="min-h-16" />
              <Button type="submit" disabled={!draft.displayName.trim() || !draft.summary.trim()}>
                <Check className="h-4 w-4" />
                Save persona
              </Button>
            </form>
            {personaStatus ? <StatusText>{personaStatus}</StatusText> : null}
          </div>
        ) : null}

        {activeTab === "memory" ? (
          <div className="grid gap-3">
            <form onSubmit={addMemory} className="grid gap-2">
              <Textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} placeholder="Add a fact, preference, boundary, or scene detail." className="min-h-28" />
              <Button type="submit" disabled={!memoryDraft.trim()}>
                <Plus className="h-4 w-4" />
                Add memory
              </Button>
            </form>
            {memoryStatus ? <StatusText>{memoryStatus}</StatusText> : null}
            <div className="grid gap-2">
              {memories.map((memory) => (
                <div key={memory.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 shadow-[var(--glass-highlight)]">
                  <p className="text-sm leading-5 text-[var(--text-primary)]">{memory.content}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{memory.category}{memory.pinned ? " - pinned" : ""}</p>
                </div>
              ))}
              {memories.length === 0 ? <StatusText>No memories for this character yet.</StatusText> : null}
            </div>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="grid gap-2">
            {chats.map((chat) => (
              <Link key={chat.id} href={`/chat/${chat.id}`} className={cn("flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 no-underline shadow-[var(--glass-highlight)] transition-colors hover:bg-white/[0.055]", chat.id === chatId && "border-[rgb(var(--accent-rgb)_/_0.38)] bg-[var(--accent-purple-soft)]")}>
                <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="xs" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{chat.title || chat.character.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{chat.character.description || chat.messages[0]?.content || "Continue chat"}</span>
                </span>
              </Link>
            ))}
            {chats.length === 0 ? <StatusText>No chat history yet.</StatusText> : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function StatusText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm leading-5 text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">
      {children}
    </p>
  );
}

function profileFromApi(profile: Record<string, unknown>): PersonaProfile {
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

function profileToDraft(profile: Record<string, unknown>): PersonaDraft {
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
