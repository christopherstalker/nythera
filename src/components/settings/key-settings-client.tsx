"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceMuted } from "@/components/ui/page";

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
  { provider: "gemini", displayName: "Gemini", apiFormat: "GEMINI", baseUrl: "", defaultModel: "gemini-2.5-flash" },
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
    <Surface className="p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 text-[#8fd8c2]" />
        <div>
          <h2 className="font-semibold">Secure model access</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Connect your preferred AI provider when you want live responses. Velora stores access securely and only shows masked keys after saving.
          </p>
        </div>
      </div>

      <SurfaceMuted className="mt-6 flex items-start gap-3 p-4">
        <LockKeyhole className="mt-0.5 h-4 w-4 text-[#8fd8c2]" />
        <p className="text-xs leading-5 text-muted-foreground">
          Your browser never receives saved secrets. You can still chat with the local fallback until you add a provider.
        </p>
      </SurfaceMuted>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <select
          value={providerPresets.some((preset) => preset.provider === provider) ? provider : "custom"}
          onChange={(event) => applyPreset(event.target.value)}
          className="focus-ring h-12 rounded-[22px] border border-white/[0.035] bg-white/[0.032] px-4 text-sm shadow-inset"
        >
          {providerPresets.map((preset) => (
            <option key={preset.provider} value={preset.provider}>
              {preset.displayName}
            </option>
          ))}
          <option value="custom">Custom OpenAI-compatible</option>
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Provider nickname, e.g. openrouter" required />
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" required />
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <select
            value={apiFormat}
            onChange={(event) => setApiFormat(event.target.value as ApiFormat)}
            className="focus-ring h-12 rounded-[22px] border border-white/[0.035] bg-white/[0.032] px-4 text-sm shadow-inset"
          >
            <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
            <option value="OPENAI">OpenAI</option>
            <option value="ANTHROPIC">Anthropic</option>
            <option value="GEMINI">Gemini</option>
          </select>
          <Input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="Connection URL, e.g. https://openrouter.ai/api/v1"
            disabled={apiFormat === "ANTHROPIC" || apiFormat === "GEMINI"}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} placeholder="Preferred model, e.g. gpt-4o-mini" />
          <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste access key" type="password" required />
          <Button type="submit" disabled={saving || !apiKey.trim() || !provider.trim() || !displayName.trim()}>
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Private note, optional" />
      </form>

      {status ? <p className="mt-3 rounded-2xl border border-white/[0.055] bg-white/[0.028] p-3 text-sm text-muted-foreground shadow-inset">{status}</p> : null}

      <div className="mt-6 grid gap-3">
        {keys.length === 0 ? (
          <p className="rounded-3xl border border-white/[0.025] bg-white/[0.024] p-5 text-sm leading-7 text-muted-foreground shadow-inset">
            No secure access saved yet. Chat still works with local fallback; add a provider when you want live model responses.
          </p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-3 rounded-3xl border border-white/[0.025] bg-white/[0.024] p-5 shadow-inset">
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
    </Surface>
  );
}
