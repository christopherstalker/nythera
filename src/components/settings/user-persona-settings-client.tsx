"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ImagePlus, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
};

type PersonaProfile = PersonaDraft & {
  id: string;
};

const emptyDraft: PersonaDraft = {
  label: "",
  displayName: "",
  avatarUrl: "",
  summary: "",
  background: "",
  traits: "",
  likes: "",
  dislikes: "",
  boundaries: "",
  visibility: "PRIVATE"
};

export function UserPersonaSettingsClient() {
  const [draft, setDraft] = useState<PersonaDraft>(emptyDraft);
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPersona()
      .catch(() => setStatus("Sign in to manage your persona."));
  }, []);

  async function fetchPersona() {
    const response = await fetch("/api/user-persona", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const body = await response.json();
    const nextProfiles = Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : [];
    setProfiles(nextProfiles);
    setActiveProfileId(body.activeProfileId ?? nextProfiles[0]?.id ?? null);

    if (body.activeProfile) {
      setDraft(profileToDraft(body.activeProfile));
    } else if (body.persona) {
      setDraft(profileToDraft({ ...body.persona, id: "default", label: body.persona.displayName }));
    }
  }

  function update<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file.");
      return;
    }

    if (file.size > 1_500_000) {
      setStatus("Persona photo must be smaller than 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      update("avatarUrl", String(reader.result ?? ""));
      setStatus(null);
    };
    reader.onerror = () => setStatus("Could not read persona photo.");
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    const response = await fetch("/api/user-persona", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: draft.displayName,
        profileId: draft.profileId,
        label: draft.label || draft.displayName,
        avatarUrl: draft.avatarUrl,
        summary: draft.summary,
        background: draft.background,
        traits: parseLines(draft.traits),
        likes: parseLines(draft.likes),
        dislikes: parseLines(draft.dislikes),
        boundaries: parseLines(draft.boundaries),
        visibility: draft.visibility
      })
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save persona.");
      return;
    }

    setStatus("Persona saved.");
    const body = await response.json().catch(() => null);
    if (body?.activeProfile) {
      setDraft(profileToDraft(body.activeProfile));
      setActiveProfileId(body.activeProfileId ?? body.activeProfile.id);
      setProfiles(Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : []);
    }
  }

  async function switchProfile(profile: PersonaProfile) {
    setDraft(profileToDraft(profile));
    setActiveProfileId(profile.id);

    await fetch("/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activeProfileId: profile.id })
    });
  }

  function newPersona() {
    setDraft({ ...emptyDraft, label: "New persona" });
    setActiveProfileId(null);
    setStatus(null);
  }

  async function remove() {
    await fetch("/api/user-persona", { method: "DELETE" });
    setDraft(emptyDraft);
    setProfiles([]);
    setActiveProfileId(null);
    setStatus("Persona deleted.");
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => void switchProfile(profile)}
            className={cn(
              "focus-ring h-10 shrink-0 rounded-[var(--radius-pill)] border px-4 text-sm font-medium transition-colors",
              activeProfileId === profile.id
                ? "border-transparent bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white"
                : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {profile.label || profile.displayName}
          </button>
        ))}
        <Button type="button" variant="outline" onClick={newPersona}>
          <Plus className="h-4 w-4" />
          New persona
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Input value={draft.label} onChange={(event) => update("label", event.target.value)} placeholder="Profile label, e.g. Main RP" />
        <Input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Persona name" required />
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <label className="focus-ring flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-center shadow-[var(--glass-highlight)] backdrop-blur-xl transition hover:border-[var(--accent-purple)] hover:bg-white/[0.045]">
          <span className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-elevated)] text-[var(--accent-purple)] shadow-[var(--shadow-glow)]">
            {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-8 w-8" />}
          </span>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <ImagePlus className="h-4 w-4" />
            Upload photo
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={onAvatarFile} />
        </label>
        <div className="grid content-start gap-3">
          <Input value={draft.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} placeholder="Avatar URL or uploaded data URL" />
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Upload a photo or paste an image URL. This avatar is included in persona switching and chat quick access.
          </p>
          {draft.avatarUrl ? (
            <Button type="button" variant="outline" onClick={() => update("avatarUrl", "")}>
              <X className="h-4 w-4" />
              Clear photo
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="Who you are in roleplay scenes." required />
      <Textarea value={draft.background} onChange={(event) => update("background", event.target.value)} placeholder="Optional background, history, or ongoing context." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea value={draft.traits} onChange={(event) => update("traits", event.target.value)} placeholder="Traits, one per line" />
        <Textarea value={draft.likes} onChange={(event) => update("likes", event.target.value)} placeholder="Likes, one per line" />
        <Textarea value={draft.dislikes} onChange={(event) => update("dislikes", event.target.value)} placeholder="Dislikes, one per line" />
        <Textarea value={draft.boundaries} onChange={(event) => update("boundaries", event.target.value)} placeholder="Boundaries, one per line" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || !draft.displayName.trim() || !draft.summary.trim()}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save persona"}
        </Button>
        <Button type="button" variant="outline" onClick={remove}>
          <Trash2 className="h-4 w-4" />
          Delete persona
        </Button>
      </div>
      {status ? <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">{status}</p> : null}
    </form>
  );
}

function profileFromApi(profile: Record<string, unknown>): PersonaProfile {
  return {
    id: String(profile.id ?? "default"),
    profileId: String(profile.id ?? "default"),
    label: String(profile.label ?? profile.displayName ?? "Persona"),
    displayName: String(profile.displayName ?? ""),
    avatarUrl: String(profile.avatarUrl ?? ""),
    summary: String(profile.summary ?? ""),
    background: String(profile.background ?? ""),
    traits: Array.isArray(profile.traits) ? profile.traits.join("\n") : "",
    likes: Array.isArray(profile.likes) ? profile.likes.join("\n") : "",
    dislikes: Array.isArray(profile.dislikes) ? profile.dislikes.join("\n") : "",
    boundaries: Array.isArray(profile.boundaries) ? profile.boundaries.join("\n") : "",
    visibility: profile.visibility === "PUBLIC" || profile.visibility === "UNLISTED" ? profile.visibility : "PRIVATE"
  };
}

function profileToDraft(profile: Record<string, unknown>): PersonaDraft {
  return profileFromApi(profile);
}

function parseLines(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}
