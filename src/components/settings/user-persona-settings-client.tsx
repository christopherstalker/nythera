"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Check, Download, History, ImagePlus, Plus, RotateCcw, Save, Star, Trash2, Upload, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyPersonaDraft,
  personaDraftPayload,
  personaEditorLines,
  personaProfileFromApi,
  type PersonaDraft,
  type PersonaProfile
} from "@/lib/user-persona-editor";
import { userPersonaSchema } from "@/lib/validation";
import "./user-persona-settings.css";
import { cn } from "@/lib/utils";

type PersonaRevision = { id: string; version: number; createdAt: string };

const suggestedTraits = ["Curious", "Reserved", "Loyal", "Witty", "Stubborn", "Empathetic"];

export function UserPersonaSettingsClient() {
  const [draft, setDraft] = useState<PersonaDraft>(emptyPersonaDraft);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingDefault, setChangingDefault] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [revisions, setRevisions] = useState<PersonaRevision[]>([]);
  const traits = personaEditorLines(draft.traits);
  const canSave = userPersonaSchema.safeParse(personaDraftPayload(draft)).success;
  const invalidTraits = traits.length > 24 || traits.some((trait) => trait.length > 160);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;

  useEffect(() => {
    fetchPersona()
      .catch(() => setStatus("Could not load your personas. Reload the page to try again."))
      .finally(() => setLoading(false));
  }, []);

  async function fetchPersona(preferredProfileId?: string) {
    const response = await fetch("/api/user-persona", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load personas.");

    const body = await response.json();
    const nextProfiles = Array.isArray(body.profiles) ? body.profiles.map(personaProfileFromApi) : [];
    setProfiles(nextProfiles);
    const preferredProfile = nextProfiles.find((profile: PersonaProfile) => profile.id === preferredProfileId);
    setActiveProfileId(preferredProfile?.id ?? body.activeProfileId ?? nextProfiles[0]?.id ?? null);
    setDefaultProfileId(body.defaultProfileId ?? null);

    if (preferredProfile) {
      setDraft(preferredProfile);
    } else if (body.activeProfile) {
      const nextDraft = personaProfileFromApi(body.activeProfile);
      setDraft(nextDraft);
    } else if (body.persona) {
      const nextDraft = personaProfileFromApi({ ...body.persona, id: "default", label: body.persona.displayName });
      setDraft(nextDraft);
    }
  }

  function update<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function renderPhotoUpload(compact = false) {
    return (
      <div
        className={cn("grid gap-3", compact ? "grid-cols-[96px_minmax(0,1fr)]" : "sm:grid-cols-[140px_minmax(0,1fr)]")}
      >
        <ImageFilePicker
          onPick={(dataUrl) => {
            update("avatarUrl", dataUrl);
            setStatus(null);
          }}
          onError={(message) => setStatus(message)}
          onUploadingChange={setAvatarUploading}
          className={cn(
            "focus-ring flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-center transition hover:border-[var(--accent-purple)]",
            compact ? "min-h-[96px]" : "min-h-[140px]"
          )}
        >
          <span
            className={cn(
              "grid place-items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-surface)] text-[var(--accent-purple)]",
              compact ? "h-16 w-16" : "h-20 w-20"
            )}
          >
            {draft.avatarUrl ? (
              <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Upload className={compact ? "h-5 w-5" : "h-6 w-6"} />
            )}
          </span>
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <ImagePlus className="h-3.5 w-3.5" />
            {avatarUploading ? "Processing..." : "Choose photo"}
          </span>
        </ImageFilePicker>
        <div className="grid content-start gap-2">
          {!compact ? (
            <Input
              value={draft.avatarUrl}
              onChange={(event) => update("avatarUrl", event.target.value)}
              placeholder="Avatar URL (optional)"
            />
          ) : null}
          <p className="text-xs leading-5 text-[var(--text-secondary)]">
            Tap the photo area to pick from your gallery.
          </p>
          {draft.avatarUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={() => update("avatarUrl", "")}>
              <X className="h-4 w-4" />
              Clear photo
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/user-persona", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(personaDraftPayload(draft))
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save persona.");
      if (body.activeProfile) {
        setDraft(personaProfileFromApi(body.activeProfile));
        setActiveProfileId(body.activeProfileId ?? body.activeProfile.id);
        setDefaultProfileId(body.defaultProfileId ?? null);
        setProfiles(Array.isArray(body.profiles) ? body.profiles.map(personaProfileFromApi) : []);
        setRevisions([]);
        window.dispatchEvent(new CustomEvent("nythera:persona-updated"));
      }
      setStatus("Persona saved. Your appearance, personality and traits are ready for your stories.");
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : "Could not save. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  }

  function switchProfile(profile: PersonaProfile) {
    const nextDraft = { ...profile };
    setRevisions([]);
    setDraft(nextDraft);
    setActiveProfileId(profile.id);
    setStatus(null);
  }

  async function changeDefaultPersona(profileId: string | null) {
    setChangingDefault(true);
    setStatus(null);
    const response = await fetch("/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultProfileId: profileId })
    });
    const body = await response.json().catch(() => null);
    setChangingDefault(false);

    if (!response.ok) {
      setStatus(body?.error ?? "Could not update default persona.");
      return;
    }

    setProfiles(Array.isArray(body?.profiles) ? body.profiles.map(personaProfileFromApi) : []);
    setDefaultProfileId(body?.defaultProfileId ?? null);
    setStatus(profileId ? "Default persona updated. New chats will use it." : "Default persona removed.");
    window.dispatchEvent(new CustomEvent("nythera:persona-updated"));
  }

  function newPersona() {
    setRevisions([]);
    setDraft({ ...emptyPersonaDraft });
    setActiveProfileId(null);
    setStatus(null);
  }

  async function removeActivePersona() {
    if (!activeProfileId) {
      return;
    }

    const response = await fetch("/api/user-persona", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: activeProfileId })
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setStatus(body?.error ?? "Could not delete persona.");
      return;
    }

    const nextProfiles = Array.isArray(body?.profiles) ? body.profiles.map(personaProfileFromApi) : [];
    setProfiles(nextProfiles);
    setActiveProfileId(body?.activeProfileId ?? nextProfiles[0]?.id ?? null);
    setDefaultProfileId(body?.defaultProfileId ?? null);
    if (body?.activeProfile) {
      const nextDraft = personaProfileFromApi(body.activeProfile);
      setDraft(nextDraft);
    } else {
      setDraft(emptyPersonaDraft);
    }
    setRevisions([]);
    setStatus("Persona deleted.");
    window.dispatchEvent(new CustomEvent("nythera:persona-updated"));
  }

  async function exportPersonas() {
    const response = await fetch("/api/user-persona/portable");
    if (!response.ok) return setStatus("Could not export personas.");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "nythera-personas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importPersonas(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const response = await fetch("/api/user-persona/portable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Import failed");
      await fetchPersona();
      setStatus(`${payload.personas?.length ?? 0} persona profiles imported.`);
    } catch {
      setStatus("That file is not a valid Nythera persona export.");
    }
  }

  async function loadHistory() {
    if (!activeProfileId) return;
    const response = await fetch(`/api/user-persona/versions?personaId=${encodeURIComponent(activeProfileId)}`, {
      cache: "no-store"
    });
    if (!response.ok) return setStatus("Could not load persona history.");
    const body = await response.json();
    setRevisions(Array.isArray(body.revisions) ? body.revisions : []);
  }

  async function restoreRevision(revisionId: string) {
    if (!activeProfileId) return;
    const response = await fetch("/api/user-persona/versions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personaId: activeProfileId, revisionId })
    });
    if (!response.ok) return setStatus("Could not restore that version.");
    await fetchPersona(activeProfileId);
    await loadHistory();
    setStatus("Persona version restored.");
  }

  return (
    <form onSubmit={save} className="persona-editor">
      <fieldset disabled={saving || loading || avatarUploading || changingDefault} className="persona-editor-fields">
        <legend className="sr-only">Create your persona</legend>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Personas</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {profiles.length
                  ? `${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}`
                  : "Create a persona to sync it across chat, desktop, and mobile."}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={newPersona}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void exportPersonas()}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <label>
                <Upload className="h-4 w-4" />
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void importPersonas(event)}
                  className="sr-only"
                />
              </label>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadHistory()}
              disabled={!activeProfileId}
            >
              <History className="h-4 w-4" />
              Version history
            </Button>
          </div>
          {revisions.length ? (
            <div className="grid gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
              {revisions.map((revision) => (
                <div
                  key={revision.id}
                  className="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]"
                >
                  <span>
                    Version {revision.version} · {new Date(revision.createdAt).toLocaleString()}
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void restoreRevision(revision.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => switchProfile(profile)}
                className={cn(
                  "focus-ring flex h-12 shrink-0 items-center gap-2 rounded-2xl border px-3 text-left text-sm font-medium transition-colors",
                  activeProfileId === profile.id
                    ? "border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]"
                    : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Avatar name={profile.displayName} src={profile.avatarUrl} size="xs" />
                <span className="max-w-36 truncate">{profile.label || profile.displayName}</span>
                {profile.isDefault ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] opacity-75">Default</span>
                ) : null}
                {activeProfileId === profile.id ? <Check className="h-4 w-4" /> : null}
              </button>
            ))}
          </div>
          {activeProfile ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Default persona</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  Used automatically in new chats. Existing chats keep their own persona.
                </p>
              </div>
              <Button
                type="button"
                variant={defaultProfileId === activeProfile.id ? "outline" : "primary"}
                disabled={changingDefault}
                onClick={() =>
                  void changeDefaultPersona(defaultProfileId === activeProfile.id ? null : activeProfile.id)
                }
              >
                <Star className={cn("h-4 w-4", defaultProfileId === activeProfile.id && "fill-current")} />
                {changingDefault
                  ? "Updating..."
                  : defaultProfileId === activeProfile.id
                    ? "Remove default"
                    : "Make default"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="persona-identity">
          {renderPhotoUpload(true)}
          <div className="persona-name-fields">
            <label>
              Profile label (optional)
              <Input
                value={draft.label}
                maxLength={80}
                onChange={(event) => update("label", event.target.value)}
                placeholder="Main RP, night explorer…"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                First name
                <Input
                  value={draft.displayName}
                  minLength={2}
                  maxLength={80}
                  onChange={(event) => update("displayName", event.target.value)}
                  placeholder="Alex"
                  required
                />
              </label>
              <label>
                Surname (optional)
                <Input
                  value={draft.surname}
                  maxLength={80}
                  onChange={(event) => update("surname", event.target.value)}
                  placeholder="Surname (optional)"
                />
              </label>
            </div>
            <PersonaNameCommands />
          </div>
        </div>

        <div className="persona-blocks">
          <section className="persona-block" aria-labelledby="persona-appearance-title">
            <header>
              <span className="persona-block-number" aria-hidden>
                01
              </span>
              <div>
                <h3 id="persona-appearance-title">Appearance</h3>
                <p>The details that make your persona recognizable.</p>
              </div>
              <span className="persona-optional">Optional</span>
            </header>
            <label className="sr-only" htmlFor="persona-appearance">
              Appearance
            </label>
            <Textarea
              id="persona-appearance"
              value={draft.appearance}
              maxLength={8000}
              onChange={(event) => update("appearance", event.target.value)}
              placeholder="Describe their build, hair, eyes, clothing, voice or distinctive features.

A weathered coat, dark curls and ink-stained fingers. Their voice is soft, with a hint of the coast."
              aria-describedby="persona-appearance-hint"
            />
            <div className="persona-field-note" id="persona-appearance-hint">
              <span>Write only the details that matter to you.</span>
              <span>{draft.appearance.length.toLocaleString()} / 8,000</span>
            </div>
          </section>

          <section className="persona-block" aria-labelledby="persona-personality-title">
            <header>
              <span className="persona-block-number" aria-hidden>
                02
              </span>
              <div>
                <h3 id="persona-personality-title">Personality</h3>
                <p>How they think, speak and connect with others.</p>
              </div>
            </header>
            <label className="sr-only" htmlFor="persona-personality">
              Personality
            </label>
            <Textarea
              id="persona-personality"
              value={draft.summary}
              minLength={10}
              maxLength={8000}
              onChange={(event) => update("summary", event.target.value)}
              placeholder="What drives them? How do they react under pressure? What does it take to earn their trust?

Quiet at first, quick with dry humor once comfortable. They listen closely and rarely make promises they cannot keep."
              aria-describedby="persona-personality-hint"
              required
            />
            <div className="persona-field-note" id="persona-personality-hint">
              <span>At least 10 characters. A few sentences are enough.</span>
              <span>{draft.summary.length.toLocaleString()} / 8,000</span>
            </div>
            <details className="persona-context">
              <summary>Backstory, preferences & boundaries</summary>
              <div className="persona-context-fields">
                <label>
                  Backstory
                  <Textarea
                    value={draft.background}
                    maxLength={3000}
                    onChange={(event) => update("background", event.target.value)}
                    placeholder="History or context you want to keep."
                  />
                </label>
                <label>
                  Likes
                  <Textarea
                    value={draft.likes}
                    onChange={(event) => update("likes", event.target.value)}
                    placeholder="One preference per line"
                  />
                </label>
                <label>
                  Dislikes
                  <Textarea
                    value={draft.dislikes}
                    onChange={(event) => update("dislikes", event.target.value)}
                    placeholder="One preference per line"
                  />
                </label>
                <label>
                  Boundaries
                  <Textarea
                    value={draft.boundaries}
                    onChange={(event) => update("boundaries", event.target.value)}
                    placeholder="How they should be addressed or treated. One boundary per line."
                  />
                </label>
                <p>
                  Lists support up to 24 entries, each up to 160 characters. Existing details are kept when you save.
                </p>
              </div>
            </details>
          </section>

          <section className="persona-block" aria-labelledby="persona-traits-title">
            <header>
              <span className="persona-block-number" aria-hidden>
                03
              </span>
              <div>
                <h3 id="persona-traits-title">Traits</h3>
                <p>The small qualities that shape their choices.</p>
              </div>
              <span className="persona-optional">Optional</span>
            </header>
            <label className="sr-only" htmlFor="persona-traits">
              Traits
            </label>
            <Textarea
              id="persona-traits"
              value={draft.traits}
              onChange={(event) => update("traits", event.target.value)}
              placeholder="Observant
Slow to trust
Protective of friends"
              aria-invalid={invalidTraits}
              aria-describedby="persona-traits-hint"
            />
            <div className="persona-field-note" id="persona-traits-hint">
              <span>
                {invalidTraits
                  ? "Use up to 24 traits, each no longer than 160 characters."
                  : "One trait per line, or separate them with commas."}
              </span>
              <span>{traits.length} / 24</span>
            </div>
            <div className="persona-trait-suggestions" role="group" aria-label="Suggested traits">
              {suggestedTraits.map((trait) => {
                const selected = traits.some((entry) => entry.toLowerCase() === trait.toLowerCase());
                return (
                  <button
                    type="button"
                    key={trait}
                    aria-pressed={selected}
                    disabled={!selected && traits.length >= 24}
                    onClick={() =>
                      update(
                        "traits",
                        (selected
                          ? traits.filter((entry) => entry.toLowerCase() !== trait.toLowerCase())
                          : [...traits, trait]
                        ).join("\n")
                      )
                    }
                  >
                    {selected ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                    {trait}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || avatarUploading || !canSave}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save persona"}
          </Button>
          <Button type="button" variant="outline" onClick={removeActivePersona} disabled={!activeProfileId}>
            <Trash2 className="h-4 w-4" />
            Delete this persona
          </Button>
        </div>
      </fieldset>
      {loading ? <p role="status">Loading your personas…</p> : null}
      {status ? (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)]"
        >
          {status}
        </p>
      ) : null}
    </form>
  );
}

function PersonaNameCommands() {
  return (
    <p className="text-xs leading-5 text-[var(--text-secondary)]">
      Template commands: <code className="text-[var(--codex-mint)]">{"{{user}}"}</code> for the first name and{" "}
      <code className="text-[var(--codex-mint)]">{"{{user_surname}}"}</code> for the optional surname.
    </p>
  );
}
