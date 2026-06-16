"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ImagePlus, Plus, Save, SlidersHorizontal, Trash2, Upload, Wand2, X } from "lucide-react";
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

type FormMode = "simple" | "advanced";

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
  const [freeform, setFreeform] = useState("");
  const [formMode, setFormMode] = useState<FormMode>("simple");
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isSimpleMode = formMode === "simple";
  const canSaveSimple = Boolean(draft.displayName.trim().length >= 2 && freeform.trim().length >= 10);
  const canSaveAdvanced = Boolean(draft.displayName.trim() && draft.summary.trim());

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
      const nextDraft = profileToDraft(body.activeProfile);
      setDraft(nextDraft);
      setFreeform(buildFreeformFromDraft(nextDraft));
    } else if (body.persona) {
      const nextDraft = profileToDraft({ ...body.persona, id: "default", label: body.persona.displayName });
      setDraft(nextDraft);
      setFreeform(buildFreeformFromDraft(nextDraft));
    }
  }

  function update<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function switchFormMode(nextMode: FormMode) {
    if (nextMode === "simple") {
      setFreeform(buildFreeformFromDraft(draft));
    } else {
      setDraft((current) => ({
        ...current,
        summary: freeform.trim() || current.summary,
        label: current.label || current.displayName
      }));
    }
    setFormMode(nextMode);
    setStatus(null);
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

    const payload = isSimpleMode
      ? {
          displayName: draft.displayName.trim(),
          profileId: draft.profileId,
          label: draft.displayName.trim(),
          avatarUrl: draft.avatarUrl,
          summary: freeform.trim(),
          background: "",
          traits: [],
          likes: [],
          dislikes: [],
          boundaries: [],
          visibility: draft.visibility
        }
      : {
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
        };

    const response = await fetch("/api/user-persona", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
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
      const nextDraft = profileToDraft(body.activeProfile);
      setDraft(nextDraft);
      setFreeform(buildFreeformFromDraft(nextDraft));
      setActiveProfileId(body.activeProfileId ?? body.activeProfile.id);
      setProfiles(Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : []);
    }
  }

  async function switchProfile(profile: PersonaProfile) {
    const nextDraft = profileToDraft(profile);
    setDraft(nextDraft);
    setFreeform(buildFreeformFromDraft(nextDraft));
    setActiveProfileId(profile.id);

    await fetch("/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activeProfileId: profile.id })
    });
  }

  function newPersona() {
    setDraft({ ...emptyDraft, label: "New persona" });
    setFreeform("");
    setFormMode("simple");
    setActiveProfileId(null);
    setStatus(null);
  }

  async function remove() {
    await fetch("/api/user-persona", { method: "DELETE" });
    setDraft(emptyDraft);
    setFreeform("");
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

      <div className="glass-panel grid grid-cols-2 gap-2 p-2">
        <ModeButton label="Simple" icon={Wand2} active={isSimpleMode} onClick={() => switchFormMode("simple")} />
        <ModeButton label="Advanced" icon={SlidersHorizontal} active={!isSimpleMode} onClick={() => switchFormMode("advanced")} />
      </div>

      {isSimpleMode ? (
        <div className="grid gap-4">
          <Input
            value={draft.displayName}
            onChange={(event) => update("displayName", event.target.value)}
            placeholder="Display name"
            required
          />
          <Textarea
            value={freeform}
            onChange={(event) => setFreeform(event.target.value)}
            placeholder={"Describe yourself however you want — personality, appearance, backstory, preferences, boundaries...\n\nExample:\nI'm Alex, 24, quiet but sharp. I speak in short sentences and hate being rushed. I grew up near the coast and still miss the sea. I don't do horror or gore."}
            className="min-h-[280px] leading-7"
            required
          />
          <details className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">Optional photo</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className="focus-ring flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-center transition hover:border-[var(--accent-purple)]">
                <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-surface)] text-[var(--accent-purple)]">
                  {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-6 w-6" />}
                </span>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload
                </span>
                <input type="file" accept="image/*" className="sr-only" onChange={onAvatarFile} />
              </label>
              <div className="grid content-start gap-2">
                <Input value={draft.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} placeholder="Avatar URL (optional)" />
                {draft.avatarUrl ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => update("avatarUrl", "")}>
                    <X className="h-4 w-4" />
                    Clear photo
                  </Button>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      ) : (
        <>
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
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || (isSimpleMode ? !canSaveSimple : !canSaveAdvanced)}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save persona"}
        </Button>
        {isSimpleMode ? (
          <Button type="button" variant="outline" onClick={() => switchFormMode("advanced")}>
            <SlidersHorizontal className="h-4 w-4" />
            Advanced editor
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={remove}>
          <Trash2 className="h-4 w-4" />
          Delete persona
        </Button>
      </div>
      {status ? <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">{status}</p> : null}
    </form>
  );
}

function ModeButton({
  label,
  icon: Icon,
  active,
  onClick
}: {
  label: string;
  icon: typeof Wand2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] text-sm font-semibold transition-colors duration-150",
        active
          ? "bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-glow)]"
          : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function buildFreeformFromDraft(draft: PersonaDraft) {
  if (draft.traits || draft.likes || draft.dislikes || draft.boundaries || draft.background) {
    return [
      draft.summary,
      draft.background ? `\n\n${draft.background}` : "",
      draft.traits ? `\n\nTraits:\n${draft.traits}` : "",
      draft.likes ? `\n\nLikes:\n${draft.likes}` : "",
      draft.dislikes ? `\n\nDislikes:\n${draft.dislikes}` : "",
      draft.boundaries ? `\n\nBoundaries:\n${draft.boundaries}` : ""
    ]
      .join("")
      .trim();
  }

  return draft.summary;
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
