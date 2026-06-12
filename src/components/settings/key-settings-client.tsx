"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SavedKey = {
  id: string;
  provider: string;
  displayName: string;
  apiFormat: ApiFormat;
  baseUrl?: string | null;
  defaultModel?: string | null;
  label?: string | null;
  last4: string;
  updatedAt: string;
};

type ApiFormat = "OPENAI" | "ANTHROPIC" | "GEMINI" | "OPENAI_COMPATIBLE";

const providerPresets: Array<{
  provider: string;
  displayName: string;
  apiFormat: ApiFormat;
  baseUrl: string;
  defaultModel: string;
}> = [
  { provider: "openai", displayName: "OpenAI", apiFormat: "OPENAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { provider: "anthropic", displayName: "Anthropic", apiFormat: "ANTHROPIC", baseUrl: "", defaultModel: "claude-3-5-sonnet-latest" },
  { provider: "gemini", displayName: "Gemini", apiFormat: "GEMINI", baseUrl: "", defaultModel: "gemini-1.5-flash" },
  { provider: "openrouter", displayName: "OpenRouter", apiFormat: "OPENAI_COMPATIBLE", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini" },
  { provider: "deepseek", displayName: "DeepSeek", apiFormat: "OPENAI_COMPATIBLE", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { provider: "groq", displayName: "Groq", apiFormat: "OPENAI_COMPATIBLE", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.1-8b-instant" },
  { provider: "together", displayName: "Together AI", apiFormat: "OPENAI_COMPATIBLE", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
  { provider: "mistral", displayName: "Mistral", apiFormat: "OPENAI_COMPATIBLE", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest" }
];

const defaultPreset = providerPresets[0];

export function KeySettingsClient() {
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [provider, setProvider] = useState(defaultPreset.provider);
  const [displayName, setDisplayName] = useState(defaultPreset.displayName);
  const [apiFormat, setApiFormat] = useState<ApiFormat>(defaultPreset.apiFormat);
  const [baseUrl, setBaseUrl] = useState(defaultPreset.baseUrl);
  const [defaultModel, setDefaultModel] = useState(defaultPreset.defaultModel);
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
      body: JSON.stringify({ provider, displayName, apiFormat, baseUrl, defaultModel, apiKey, label })
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

  function applyPreset(providerName: string) {
    const preset = providerPresets.find((item) => item.provider === providerName);
    if (!preset) {
      setProvider("custom-provider");
      setDisplayName("Custom provider");
      setApiFormat("OPENAI_COMPATIBLE");
      setBaseUrl("");
      setDefaultModel("");
      return;
    }

    setProvider(preset.provider);
    setDisplayName(preset.displayName);
    setApiFormat(preset.apiFormat);
    setBaseUrl(preset.baseUrl);
    setDefaultModel(preset.defaultModel);
  }

  async function remove(providerName: string) {
    await fetch(`/api/keys?provider=${providerName}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card-glow">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Model keys</h2>
          <p className="text-sm text-muted-foreground">
            Bring any OpenAI-compatible provider key, or use native OpenAI, Anthropic, and Gemini adapters. Keys stay encrypted server-side.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3">
        <select
          value={providerPresets.some((preset) => preset.provider === provider) ? provider : "custom"}
          onChange={(event) => applyPreset(event.target.value)}
          className="focus-ring h-11 rounded-2xl border border-border bg-[hsl(var(--input))] px-3 text-sm"
        >
          {providerPresets.map((preset) => (
            <option key={preset.provider} value={preset.provider}>
              {preset.displayName}
            </option>
          ))}
          <option value="custom">Custom OpenAI-compatible</option>
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="provider id, e.g. openrouter" required />
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" required />
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <select
            value={apiFormat}
            onChange={(event) => setApiFormat(event.target.value as ApiFormat)}
            className="focus-ring h-11 rounded-2xl border border-border bg-[hsl(var(--input))] px-3 text-sm"
          >
            <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
            <option value="OPENAI">OpenAI native</option>
            <option value="ANTHROPIC">Anthropic native</option>
            <option value="GEMINI">Gemini native</option>
          </select>
          <Input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="Base URL, e.g. https://openrouter.ai/api/v1"
            disabled={apiFormat === "ANTHROPIC" || apiFormat === "GEMINI"}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} placeholder="Default model, e.g. openai/gpt-4o-mini" />
          <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste provider API key" type="password" required />
          <Button type="submit" disabled={saving || !apiKey.trim() || !provider.trim() || !displayName.trim()}>
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label, optional" />
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
                <p className="text-sm font-semibold">{key.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {key.label || key.apiFormat} - {key.defaultModel || "no default model"} - ending in {key.last4}
                </p>
                {key.baseUrl ? <p className="mt-1 max-w-[52rem] truncate text-xs text-muted-foreground">{key.baseUrl}</p> : null}
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
