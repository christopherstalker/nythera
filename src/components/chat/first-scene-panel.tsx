"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIRST_CLASS_PROVIDER_PRESETS } from "@/lib/provider-presets";
import { LocalModelPanel } from "@/components/settings/local-model-panel";
import { LOCAL_MODEL_EVENT, readLocalModel, saveLocalModel } from "@/lib/local-model";

type Connection = {
  id: string;
  provider: string;
  displayName: string;
  defaultModel?: string;
  credentialStatus?: string;
};
const OPENINGS = [
  { label: "Ask a question", text: 'I look toward you. "What should I know before we begin?"' },
  { label: "Follow the scene", text: "I take a moment to look around, then turn my attention back to you." },
  {
    label: "Introduce myself",
    text: '"We haven’t properly met yet." I offer a brief introduction and wait for your reply.'
  }
];

export function FirstScenePanel({
  onReady,
  onModel
}: {
  onReady: (draft: string) => void;
  onModel: (model: string) => void;
}) {
  const [keys, setKeys] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState(FIRST_CLASS_PROVIDER_PRESETS[0].provider);
  const [apiKey, setApiKey] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [opening, setOpening] = useState(0);
  const [error, setError] = useState("");
  const [localName, setLocalName] = useState<string | null>(null);
  const selectedKey = keys.find((key) => key.id === selectedKeyId && key.credentialStatus !== "INVALID");
  const ready = Boolean(localName || selectedKey?.defaultModel);

  useEffect(() => {
    const controller = new AbortController();
    const refreshLocal = () => setLocalName(readLocalModel()?.model ?? null);
    refreshLocal();
    window.addEventListener(LOCAL_MODEL_EVENT, refreshLocal);
    void fetch("/api/keys", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load connections.");
        const connections = (body.keys ?? []) as Connection[];
        setKeys(connections);
        setSelectedKeyId(connections.find((key) => key.credentialStatus !== "INVALID" && key.defaultModel)?.id ?? "");
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener(LOCAL_MODEL_EVENT, refreshLocal);
    };
  }, []);

  async function connect() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const preset = FIRST_CLASS_PROVIDER_PRESETS.find((candidate) => candidate.provider === provider)!;
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: preset.provider, apiFormat: preset.apiFormat, apiKey })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Connection failed. Check your key and retry.");
      const key = {
        ...body.key,
        defaultModel: body.key.defaultModel || preset.defaultModel,
        credentialStatus: "VALID"
      } as Connection;
      setKeys((current) => [...current.filter((entry) => entry.id !== key.id), key]);
      setSelectedKeyId(key.id);
      setApiKey("");
      saveLocalModel(null);
      window.dispatchEvent(new Event("nythera:provider-keys-updated"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        Choose a connection and an opening. You can adjust the rest while you play.
      </p>
      <section>
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
            1
          </span>
          Your model
        </p>
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading connections…
          </p>
        ) : (
          <>
            {localName ? (
              <p className="mb-3 rounded-lg border border-[var(--accent-purple)]/30 p-3 text-xs text-[var(--text-primary)]">
                On this computer · {localName}
              </p>
            ) : null}
            {keys.length > 0 ? (
              <>
                <label htmlFor="first-scene-key" className="sr-only">
                  Saved model connection
                </label>
                <select
                  id="first-scene-key"
                  className="focus-ring mb-3 h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
                  value={selectedKeyId}
                  onChange={(event) => {
                    setSelectedKeyId(event.target.value);
                    saveLocalModel(null);
                  }}
                >
                  <option value="">Choose a saved connection</option>
                  {keys.map((key) => (
                    <option
                      key={key.id}
                      value={key.id}
                      disabled={key.credentialStatus === "INVALID" || !key.defaultModel}
                    >
                      {key.displayName} · {key.defaultModel || "Choose a default model in Settings"}
                      {key.credentialStatus === "INVALID" ? " · Reconnect" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <details open={!keys.length && !localName} className="rounded-xl border border-[var(--border-default)] p-3">
              <summary className="focus-ring flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <KeyRound className="h-4 w-4" />
                Connect a cloud model
              </summary>
              <div className="grid gap-3 pt-2">
                <label htmlFor="first-scene-provider" className="sr-only">
                  Cloud provider
                </label>
                <select
                  id="first-scene-provider"
                  value={provider}
                  disabled={saving}
                  onChange={(event) => {
                    setProvider(event.target.value);
                    setApiKey("");
                    setError("");
                  }}
                  className="focus-ring h-11 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
                >
                  {FIRST_CLASS_PROVIDER_PRESETS.map((preset) => (
                    <option key={preset.provider} value={preset.provider}>
                      {preset.displayName}
                    </option>
                  ))}
                </select>
                <label htmlFor="first-scene-api-key" className="sr-only">
                  Provider API key
                </label>
                <Input
                  id="first-scene-api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  disabled={saving}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste your provider API key"
                />
                <p className="text-xs leading-5 text-[var(--text-muted)]">
                  Your key is verified and encrypted before storage. Model usage is billed by your provider.
                </p>
                <Button disabled={saving || apiKey.trim().length < 6} onClick={() => void connect()}>
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? "Checking connection…" : "Verify and connect"}
                </Button>
              </div>
            </details>
          </>
        )}
        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 p-3 text-xs text-rose-300">
            {error}
          </p>
        ) : null}
        <div className="mt-3">
          <LocalModelPanel />
        </div>
      </section>
      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
            2
          </span>
          Your opening
        </legend>
        <div className="grid gap-2">
          {OPENINGS.map((choice, index) => (
            <label
              key={choice.label}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${opening === index ? "border-[var(--accent-purple)] bg-[var(--accent-purple-soft)]" : "border-[var(--border-default)]"}`}
            >
              <input
                type="radio"
                name="first-scene-opening"
                checked={opening === index}
                onChange={() => setOpening(index)}
                className="mt-1 accent-[var(--accent-purple)]"
              />
              <span>
                <span className="block text-xs font-medium text-[var(--text-primary)]">{choice.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{choice.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4">
        <Link
          href="/settings/providers"
          className="focus-ring text-xs text-[var(--text-muted)] underline underline-offset-4"
        >
          Advanced settings
        </Link>
        <Button
          disabled={!ready || saving}
          onClick={() => {
            if (!localName && selectedKey?.defaultModel) onModel(`${selectedKey.provider}:${selectedKey.defaultModel}`);
            onReady(OPENINGS[opening].text);
          }}
        >
          Use opening
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        The opening is placed in the composer so you can edit it before sending.
      </p>
    </div>
  );
}
