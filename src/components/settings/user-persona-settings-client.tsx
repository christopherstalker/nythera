"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PersonaDraft = {
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

const emptyDraft: PersonaDraft = {
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
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user-persona", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.persona) {
          return;
        }
        setDraft({
          displayName: body.persona.displayName ?? "",
          avatarUrl: body.persona.avatarUrl ?? "",
          summary: body.persona.summary ?? "",
          background: body.persona.background ?? "",
          traits: (body.persona.traits ?? []).join("\n"),
          likes: (body.persona.likes ?? []).join("\n"),
          dislikes: (body.persona.dislikes ?? []).join("\n"),
          boundaries: (body.persona.boundaries ?? []).join("\n"),
          visibility: body.persona.visibility ?? "PRIVATE"
        });
      })
      .catch(() => setStatus("Sign in to manage your persona."));
  }, []);

  function update<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
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
  }

  async function remove() {
    await fetch("/api/user-persona", { method: "DELETE" });
    setDraft(emptyDraft);
    setStatus("Persona deleted.");
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Persona name" required />
        <Input value={draft.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} placeholder="Avatar URL or data URL" />
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
      {status ? <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">{status}</p> : null}
    </form>
  );
}

function parseLines(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}
