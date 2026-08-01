"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ListOrdered, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIRST_CLASS_PROVIDER_PRESETS, type ProviderApiFormat } from "@/lib/provider-presets";

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
  isDefault: boolean;
  fallbackEnabled: boolean;
  fallbackPriority?: number | null;
};

type ApiFormat = ProviderApiFormat;

const providers = FIRST_CLASS_PROVIDER_PRESETS;
const blankCustomProvider = {
  provider: "",
  displayName: "",
  apiFormat: "OPENAI_COMPATIBLE" as ApiFormat,
  baseUrl: "",
  defaultModel: "",
  apiKey: ""
};

export function KeySettingsClient() {
  const { status: sessionStatus } = useSession();
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState(blankCustomProvider);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void refresh();
      return;
    }

    if (sessionStatus === "unauthenticated") {
      setStatus("Sign in to manage model keys.");
    }
  }, [sessionStatus]);

  const savedByProvider = useMemo(() => {
    return new Map(keys.map((key) => [key.provider, key]));
  }, [keys]);

  async function refresh() {
    const response = await fetch("/api/keys");
    if (!response.ok) {
      setStatus("Sign in to manage model keys.");
      return;
    }

    const body = await response.json();
    setKeys(body.keys ?? []);
  }

  async function saveProvider(event: FormEvent<HTMLFormElement>, providerName: string) {
    event.preventDefault();
    const config = providers.find((item) => item.provider === providerName);
    const apiKey = values[providerName]?.trim();
    if (!config || !apiKey) {
      return;
    }

    setSaving((current) => ({ ...current, [providerName]: true }));
    setStatus(null);

    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: config.provider,
        displayName: config.displayName,
        apiFormat: config.apiFormat,
        baseUrl: config.baseUrl,
        defaultModel: config.defaultModel,
        apiKey,
        label: `${config.displayName} key`
      })
    });

    setSaving((current) => ({ ...current, [providerName]: false }));

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? `Could not save ${config.displayName} key.`);
      return;
    }

    setValues((current) => ({ ...current, [providerName]: "" }));
    setStatus(`${config.displayName} key saved.`);
    await refresh();
  }

  async function remove(providerName: string) {
    await fetch(`/api/keys?provider=${providerName}`, { method: "DELETE" });
    await refresh();
  }

  async function saveCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!custom.provider.trim() || !custom.apiKey.trim()) {
      return;
    }

    setStatus(null);
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: custom.provider,
        displayName: custom.displayName || custom.provider,
        apiFormat: custom.apiFormat,
        baseUrl: custom.baseUrl,
        defaultModel: custom.defaultModel,
        apiKey: custom.apiKey,
        label: `${custom.displayName || custom.provider} key`
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save custom provider.");
      return;
    }

    setCustom(blankCustomProvider);
    setStatus("Custom provider endpoint saved.");
    await refresh();
  }

  async function copy(providerName: string) {
    const value = values[providerName] ?? "";
    if (value) {
      await navigator.clipboard?.writeText(value);
      setStatus("Key copied.");
    }
  }

  function moveFallback(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= keys.length || keys[index]?.isDefault || keys[target]?.isDefault) {
      return;
    }
    setKeys((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleFallback(provider: string) {
    setKeys((current) =>
      current.map((key) =>
        key.provider === provider && !key.isDefault
          ? { ...key, fallbackEnabled: !key.fallbackEnabled }
          : key
      )
    );
  }

  async function saveFallbackChain() {
    setStatus(null);
    const response = await fetch("/api/keys/fallback", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: keys.map((key) => ({
          provider: key.provider,
          enabled: key.isDefault || key.fallbackEnabled
        }))
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(body?.error ?? "Could not save the fallback chain.");
      return;
    }
    setKeys(body?.keys ?? keys);
    setStatus("Fallback chain saved.");
  }

  return (
    <div className="grid gap-4">
      {providers.map((provider) => {
        const saved = savedByProvider.get(provider.provider);
        const value = values[provider.provider] ?? "";
        const isVisible = visible[provider.provider] ?? false;

        return (
          <form
            key={provider.provider}
            onSubmit={(event) => saveProvider(event, provider.provider)}
            className="glass-card p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{provider.displayName}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {saved ? `${saved.isDefault ? "Active key" : "Saved key"} ending in ${saved.last4}` : "No key saved"}
                </p>
              </div>
              {saved ? (
                <Button type="button" variant="outline" size="sm" onClick={() => remove(provider.provider)}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-[repeat(3,2.5rem)] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <Input
                value={value}
                onChange={(event) => setValues((current) => ({ ...current, [provider.provider]: event.target.value }))}
                type={isVisible ? "text" : "password"}
                placeholder={provider.placeholder}
                autoComplete="off"
                className="col-span-3 sm:col-span-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={isVisible ? "Hide key" : "Show key"}
                onClick={() => setVisible((current) => ({ ...current, [provider.provider]: !isVisible }))}
              >
                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Copy key" onClick={() => copy(provider.provider)} disabled={!value}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Clear key input"
                onClick={() => setValues((current) => ({ ...current, [provider.provider]: "" }))}
                disabled={!value}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button type="submit" className="mt-3" disabled={!value.trim() || saving[provider.provider]}>
              <Save className="h-4 w-4" />
              {saving[provider.provider] ? "Saving..." : "Save"}
            </Button>
          </form>
        );
      })}

      {keys.filter((key) => !providers.some((provider) => provider.provider === key.provider)).length > 0 ? (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Saved custom provider endpoints</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Each named endpoint appears as its own provider group in the chat model switcher.
          </p>
          <div className="mt-3 grid gap-2">
            {keys
              .filter((key) => !providers.some((provider) => provider.provider === key.provider))
              .map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3 shadow-[var(--glass-highlight)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{key.displayName}</p>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{key.provider} · {key.defaultModel || "no default model"} · ending in {key.last4}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => remove(key.provider)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {keys.length > 0 ? (
        <section className="glass-card p-4">
          <div className="flex items-start gap-3">
            <ListOrdered className="mt-0.5 h-5 w-5 text-[var(--accent-purple)]" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Fallback chain</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Rate limits, timeouts, network failures, and provider outages try enabled providers in this order. Invalid keys and rejected requests stop immediately.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {keys.map((key, index) => (
              <div key={key.provider} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                <input
                  type="checkbox"
                  checked={key.isDefault || key.fallbackEnabled}
                  disabled={key.isDefault}
                  onChange={() => toggleFallback(key.provider)}
                  aria-label={`Include ${key.displayName} in fallback chain`}
                  className="accent-[var(--accent-purple)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {index + 1}. {key.displayName} {key.isDefault ? "(primary)" : ""}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{key.defaultModel || "Provider default model"}</p>
                </div>
                <Button type="button" variant="outline" size="icon" aria-label={`Move ${key.displayName} up`} onClick={() => moveFallback(index, -1)} disabled={index === 0 || key.isDefault || keys[index - 1]?.isDefault}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={`Move ${key.displayName} down`} onClick={() => moveFallback(index, 1)} disabled={index === keys.length - 1 || key.isDefault}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" className="mt-3" onClick={() => void saveFallbackChain()}>
            <Save className="h-4 w-4" />
            Save fallback chain
          </Button>
        </section>
      ) : null}

      <form onSubmit={saveCustom} className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add custom provider endpoint</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          Save multiple named endpoints such as My Ollama, LM Studio, or vLLM. OpenRouter has a dedicated key-only card above. After setup, chats pick providers from the model switcher without raw URL typing.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Input value={custom.provider} onChange={(event) => setCustom((current) => ({ ...current, provider: event.target.value }))} placeholder="Unique provider ID, e.g. my-ollama" />
          <Input value={custom.displayName} onChange={(event) => setCustom((current) => ({ ...current, displayName: event.target.value }))} placeholder="Display name, e.g. My Ollama" />
          <select
            value={custom.apiFormat}
            onChange={(event) => setCustom((current) => ({ ...current, apiFormat: event.target.value as ApiFormat }))}
            className="focus-ring glass-input h-12 rounded-[var(--radius-md)] px-4 text-sm focus:border-[var(--accent-purple)]"
          >
            <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
            <option value="OPENAI">OpenAI native</option>
            <option value="ANTHROPIC">Anthropic native</option>
            <option value="GEMINI">Gemini native</option>
          </select>
          <Input value={custom.defaultModel} onChange={(event) => setCustom((current) => ({ ...current, defaultModel: event.target.value }))} placeholder="Default model, e.g. llama3.1" />
          <Input value={custom.baseUrl} onChange={(event) => setCustom((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="Base URL, e.g. http://localhost:11434/v1" className="sm:col-span-2" />
          <Input value={custom.apiKey} onChange={(event) => setCustom((current) => ({ ...current, apiKey: event.target.value }))} type="password" placeholder="API key" className="sm:col-span-2" autoComplete="off" />
        </div>
        <Button type="submit" className="mt-3" disabled={!custom.provider.trim() || !custom.apiKey.trim()}>
          <Save className="h-4 w-4" />
          Save custom endpoint
        </Button>
      </form>

      {status ? <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">{status}</p> : null}
    </div>
  );
}
