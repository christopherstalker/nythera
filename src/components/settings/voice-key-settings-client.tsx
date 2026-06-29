"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Save, Trash2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VoiceKey = {
  id: string;
  provider: "elevenlabs" | "playht";
  displayName: string;
  authId?: string | null;
  baseUrl?: string | null;
  defaultVoiceId?: string | null;
  last4: string;
  updatedAt: string;
};

const voiceProviders = [
  {
    provider: "elevenlabs" as const,
    displayName: "ElevenLabs",
    keyPlaceholder: "ElevenLabs API key",
    authPlaceholder: "Not required",
    voicePlaceholder: "Default voice id, e.g. 21m00Tcm4TlvDq8ikWAM"
  },
  {
    provider: "playht" as const,
    displayName: "PlayHT",
    keyPlaceholder: "PlayHT secret key",
    authPlaceholder: "PlayHT user id",
    voicePlaceholder: "Default voice URL or id"
  }
];

export function VoiceKeySettingsClient() {
  const [keys, setKeys] = useState<VoiceKey[]>([]);
  const [values, setValues] = useState<Record<string, { apiKey: string; authId: string; defaultVoiceId: string; baseUrl: string }>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const savedByProvider = useMemo(() => new Map(keys.map((key) => [key.provider, key])), [keys]);

  async function refresh() {
    const response = await fetch("/api/voice/keys", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    setKeys(Array.isArray(body.keys) ? body.keys : []);
  }

  async function save(event: FormEvent<HTMLFormElement>, provider: VoiceKey["provider"]) {
    event.preventDefault();
    const draft = values[provider];
    if (!draft?.apiKey.trim()) {
      return;
    }

    setSaving((current) => ({ ...current, [provider]: true }));
    setStatus(null);
    const response = await fetch("/api/voice/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        apiKey: draft.apiKey,
        authId: draft.authId,
        defaultVoiceId: draft.defaultVoiceId,
        baseUrl: draft.baseUrl
      })
    });
    setSaving((current) => ({ ...current, [provider]: false }));

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save voice key.");
      return;
    }

    setValues((current) => ({ ...current, [provider]: { apiKey: "", authId: "", defaultVoiceId: "", baseUrl: "" } }));
    setStatus("Voice key saved.");
    await refresh();
  }

  async function remove(provider: VoiceKey["provider"]) {
    await fetch(`/api/voice/keys?provider=${provider}`, { method: "DELETE" });
    await refresh();
  }

  function update(provider: VoiceKey["provider"], field: "apiKey" | "authId" | "defaultVoiceId" | "baseUrl", value: string) {
    setValues((current) => {
      const previous = current[provider] ?? { apiKey: "", authId: "", defaultVoiceId: "", baseUrl: "" };
      return {
        ...current,
        [provider]: {
          ...previous,
          [field]: value
        }
      };
    });
  }

  return (
    <section className="glass-card p-4">
      <div className="flex items-start gap-3">
        <Volume2 className="mt-0.5 h-5 w-5 text-[var(--accent-purple)]" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Voice BYOK</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            ElevenLabs and PlayHT keys are stored separately from model providers and are used only for text-to-speech playback.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {voiceProviders.map((provider) => {
          const saved = savedByProvider.get(provider.provider);
          const draft = values[provider.provider] ?? { apiKey: "", authId: "", defaultVoiceId: "", baseUrl: "" };
          const showSecret = visible[provider.provider] ?? false;

          return (
            <form key={provider.provider} onSubmit={(event) => save(event, provider.provider)} className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{provider.displayName}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {saved ? `Saved key ending in ${saved.last4}${saved.defaultVoiceId ? ` · voice ${saved.defaultVoiceId}` : ""}` : "No voice key saved"}
                  </p>
                </div>
                {saved ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => remove(provider.provider)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={draft.apiKey}
                  onChange={(event) => update(provider.provider, "apiKey", event.target.value)}
                  type={showSecret ? "text" : "password"}
                  placeholder={provider.keyPlaceholder}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showSecret ? "Hide voice key" : "Show voice key"}
                  onClick={() => setVisible((current) => ({ ...current, [provider.provider]: !showSecret }))}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Input
                  value={draft.authId}
                  onChange={(event) => update(provider.provider, "authId", event.target.value)}
                  placeholder={provider.authPlaceholder}
                  disabled={provider.provider === "elevenlabs"}
                />
                <Input
                  value={draft.defaultVoiceId}
                  onChange={(event) => update(provider.provider, "defaultVoiceId", event.target.value)}
                  placeholder={provider.voicePlaceholder}
                />
                <Input
                  value={draft.baseUrl}
                  onChange={(event) => update(provider.provider, "baseUrl", event.target.value)}
                  placeholder="Optional base URL override"
                  className="sm:col-span-2"
                />
              </div>
              <Button type="submit" className="mt-3" disabled={!draft.apiKey.trim() || saving[provider.provider]}>
                <Save className="h-4 w-4" />
                {saving[provider.provider] ? "Saving..." : "Save voice key"}
              </Button>
            </form>
          );
        })}
      </div>

      {status ? <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">{status}</p> : null}
    </section>
  );
}
