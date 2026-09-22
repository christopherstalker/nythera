"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, HardDrive, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOCAL_MODEL_EVENT, readLocalModel, saveLocalModel, type LocalModel } from "@/lib/local-model";

export function LocalModelPanel() {
  const fieldId = useId();
  const probeVersion = useRef(0);
  const [available, setAvailable] = useState(false);
  const [engine, setEngine] = useState<LocalModel["engine"]>("ollama");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [contextWindow, setContextWindow] = useState(8192);
  const [token, setToken] = useState("");
  const [selection, setSelection] = useState<LocalModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setAvailable(Boolean(window.nytheraDesktop?.local));
    const saved = readLocalModel();
    setSelection(saved);
    if (saved) {
      setEngine(saved.engine);
      setModel(saved.model);
      setContextWindow(saved.contextWindow);
    }
    const refresh = () => setSelection(readLocalModel());
    window.addEventListener(LOCAL_MODEL_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_MODEL_EVENT, refresh);
  }, []);

  async function discover() {
    const bridge = window.nytheraDesktop?.local;
    if (!bridge || busy) return;
    const version = ++probeVersion.current;
    setBusy(true);
    setNotice("");
    setModels([]);
    try {
      const catalog = await bridge.models(engine, token || undefined);
      if (version !== probeVersion.current) return;
      if (!catalog.ok) throw new Error(catalog.error);
      setModels(catalog.models);
      setModel((current) => (catalog.models.includes(current) ? current : (catalog.models[0] ?? "")));
      setNotice(
        catalog.models.length
          ? `${catalog.models.length} model${catalog.models.length === 1 ? "" : "s"} found on this computer.`
          : "No models found. Download a model in the selected app, then refresh."
      );
      setToken("");
    } catch (error) {
      if (version === probeVersion.current)
        setNotice(error instanceof Error ? error.message : "Could not connect to the local server.");
    } finally {
      if (version === probeVersion.current) setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)]/50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
          <HardDrive className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">On this computer</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Generate with Ollama or LM Studio. Your chats still sync with Nythera.
          </p>
        </div>
      </div>
      {!available ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-secondary)]">Requires the updated desktop app.</p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/download#desktop">Get Desktop</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2" aria-label="Local server">
            {(["ollama", "lmstudio"] as const).map((choice) => (
              <Button
                key={choice}
                type="button"
                variant={engine === choice ? "primary" : "secondary"}
                aria-pressed={engine === choice}
                disabled={busy}
                onClick={() => {
                  setEngine(choice);
                  setModels([]);
                  setModel("");
                  setToken("");
                  setNotice("");
                }}
              >
                {choice === "ollama" ? "Ollama" : "LM Studio"}
              </Button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Start the server on port {engine === "ollama" ? "11434" : "1234"}, then look for models.
          </p>
          {engine === "lmstudio" ? (
            <details className="text-xs text-[var(--text-secondary)]">
              <summary className="focus-ring cursor-pointer py-2">Server requires an access token</summary>
              <label htmlFor={`${fieldId}-token`} className="sr-only">
                Local server access token
              </label>
              <Input
                id={`${fieldId}-token`}
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                placeholder="Kept only for this desktop session"
              />
            </details>
          ) : null}
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void discover()}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {busy ? "Connecting…" : "Find models"}
          </Button>
          {models.length > 0 ? (
            <>
              <label htmlFor={`${fieldId}-model`} className="text-xs text-[var(--text-secondary)]">
                Installed model
              </label>
              <select
                id={`${fieldId}-model`}
                className="focus-ring h-11 w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <label htmlFor={`${fieldId}-context`} className="text-xs text-[var(--text-secondary)]">
                Context window configured in your local server
              </label>
              <Input
                id={`${fieldId}-context`}
                type="number"
                min={4096}
                max={1048576}
                step={1}
                value={Number.isFinite(contextWindow) ? contextWindow : ""}
                onChange={(event) => setContextWindow(event.target.valueAsNumber)}
              />
              <p className="text-xs leading-5 text-[var(--text-muted)]">
                Use the server’s actual context size. This does not change your response length limit.
              </p>
              <Button
                disabled={!model || !Number.isInteger(contextWindow) || contextWindow < 4096 || contextWindow > 1048576}
                onClick={() => {
                  saveLocalModel({ engine, model, contextWindow });
                  setNotice("Selected for chats and test scenes on this computer.");
                }}
              >
                <Check className="h-4 w-4" />
                Use this model
              </Button>
            </>
          ) : null}
          {selection ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent-purple)]/30 p-3">
              <span className="min-w-0 break-all text-xs text-[var(--text-secondary)]">Active: {selection.model}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  saveLocalModel(null);
                  setNotice("Chats will use their cloud model settings.");
                }}
              >
                Use cloud
              </Button>
            </div>
          ) : null}
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            Local mode uses pinned and profile memories without cloud semantic search. Text replies only.
          </p>
          {notice ? (
            <p
              role="status"
              className="rounded-lg bg-[var(--bg-base)] p-3 text-xs leading-5 text-[var(--text-secondary)]"
            >
              {notice}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
