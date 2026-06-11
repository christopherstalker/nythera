"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SavedKey = {
  id: string;
  provider: "OPENAI" | "ANTHROPIC" | "GEMINI";
  label?: string | null;
  last4: string;
  updatedAt: string;
};

const providerLabels: Record<SavedKey["provider"], string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Gemini"
};

export function KeySettingsClient() {
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [provider, setProvider] = useState<SavedKey["provider"]>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const response = await fetch("/api/keys");
    if (!response.ok) {
      setStatus("Sign in to manage model keys.");
      return;
    }

    const body = await response.json();
    setKeys(body.keys ?? []);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, apiKey, label })
    });
    setSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save key.");
      return;
    }

    setApiKey("");
    setLabel("");
    setStatus("Key saved. Only the masked key is shown from now on.");
    await refresh();
  }

  async function remove(providerName: SavedKey["provider"]) {
    await fetch(`/api/keys?provider=${providerName}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card-glow">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Model keys</h2>
          <p className="text-sm text-muted-foreground">Bring your own provider key. Velora encrypts it server-side and never returns it to the browser.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 md:grid-cols-[160px_1fr_1fr_auto]">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as SavedKey["provider"])}
          className="focus-ring h-11 rounded-2xl border border-border bg-[hsl(var(--input))] px-3 text-sm"
        >
          <option value="OPENAI">OpenAI</option>
          <option value="ANTHROPIC">Anthropic</option>
          <option value="GEMINI">Gemini</option>
        </select>
        <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste provider API key" type="password" required />
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label, optional" />
        <Button type="submit" disabled={saving || !apiKey.trim()}>
          {saving ? "Saving" : "Save"}
        </Button>
      </form>

      {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}

      <div className="mt-5 grid gap-3">
        {keys.length === 0 ? (
          <p className="rounded-2xl border border-border bg-background/55 p-3 text-sm text-muted-foreground">
            No keys saved. Chat still works with local fallback, but live models need a saved provider key.
          </p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/55 p-3">
              <div>
                <p className="text-sm font-semibold">{providerLabels[key.provider]}</p>
                <p className="text-xs text-muted-foreground">
                  {key.label || "Default"} - ending in {key.last4}
                </p>
              </div>
              <Button type="button" variant="outline" size="icon" title="Delete key" onClick={() => remove(key.provider)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
