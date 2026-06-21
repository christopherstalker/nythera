"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PromptGenerationMeta } from "@/lib/character-form-types";
import { cn } from "@/lib/utils";

export type PromptGeneratorOptions = {
  provider: string;
  model: string;
};

type SavedKeySummary = {
  provider: string;
  displayName: string;
  defaultModel?: string | null;
  isDefault: boolean;
};

type PromptGeneratorPanelProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: (options: PromptGeneratorOptions) => void;
  generating: boolean;
  generationMeta: PromptGenerationMeta | null;
  disabled?: boolean;
};

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-flash"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  xai: ["grok-4.3-latest"]
};

export function PromptGeneratorPanel({
  prompt,
  onPromptChange,
  onGenerate,
  generating,
  generationMeta,
  disabled = false
}: PromptGeneratorPanelProps) {
  const [keys, setKeys] = useState<SavedKeySummary[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadKeys() {
      try {
        const response = await fetch("/api/keys");
        if (!response.ok) {
          return;
        }
        const body = await response.json();
        if (!cancelled) {
          setKeys(Array.isArray(body.keys) ? body.keys : []);
        }
      } finally {
        if (!cancelled) {
          setKeysLoading(false);
        }
      }
    }

    void loadKeys();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (keys.length === 0) {
      setSelectedProvider("");
      setSelectedModel("");
      return;
    }

    const preferred = keys.find((key) => key.provider === selectedProvider) ?? keys.find((key) => key.isDefault) ?? keys[0];
    if (!selectedProvider || !keys.some((key) => key.provider === selectedProvider)) {
      setSelectedProvider(preferred.provider);
      setSelectedModel(preferred.defaultModel?.trim() || defaultModelForProvider(preferred.provider));
    }
  }, [keys, selectedProvider]);

  const activeKey = useMemo(
    () => keys.find((key) => key.provider === selectedProvider) ?? keys.find((key) => key.isDefault) ?? keys[0],
    [keys, selectedProvider]
  );

  const modelSuggestions = useMemo(() => {
    const providerSuggestions = MODEL_SUGGESTIONS[selectedProvider] ?? [];
    const defaults = activeKey?.defaultModel ? [activeKey.defaultModel] : [];
    return Array.from(new Set([...defaults, ...providerSuggestions].filter(Boolean)));
  }, [activeKey?.defaultModel, selectedProvider]);

  const hasUserKey = keys.length > 0;
  const canGenerate =
    prompt.trim().length >= 12 && hasUserKey && selectedProvider.trim().length > 0 && selectedModel.trim().length > 0 && !generating && !disabled;

  function handleProviderChange(provider: string) {
    const key = keys.find((item) => item.provider === provider);
    setSelectedProvider(provider);
    setSelectedModel(key?.defaultModel?.trim() || defaultModelForProvider(provider));
  }

  return (
    <section className="glass-panel grid gap-5 p-5 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Prompt generator</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Describe your bot</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            Write one prompt, pick your provider and model, and Nythera will build the full character on your API.
          </p>
        </div>
        <Button
          type="button"
          onClick={() =>
            onGenerate({
              provider: selectedProvider,
              model: selectedModel.trim()
            })
          }
          disabled={!canGenerate}
        >
          <Wand2 className="h-4 w-4" />
          {generating ? "Generating..." : "Generate bot"}
        </Button>
      </header>

      <label className="block">
        <span className="text-sm font-medium text-[var(--text-primary)]">Your prompt</span>
        <span className="mt-1 block text-xs text-[var(--text-muted)]">
          Example: a sarcastic cyberpunk hacker who helps the user escape a megacorp, dark humor, tense atmosphere.
        </span>
        <Textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe who the character is, their vibe, setting, relationship dynamic, and how they should speak..."
          className="mt-2 min-h-40"
        />
      </label>

      <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-[var(--text-primary)]">Provider</span>
          <select
            value={selectedProvider}
            onChange={(event) => handleProviderChange(event.target.value)}
            disabled={keysLoading || !hasUserKey}
            className="focus-ring glass-input mt-2 h-12 w-full rounded-[var(--radius-md)] px-4 text-sm disabled:opacity-60"
          >
            {keys.length === 0 ? <option value="">No API keys connected</option> : null}
            {keys.map((key) => (
              <option key={key.provider} value={key.provider}>
                {key.displayName}
                {key.isDefault ? " · default" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text-primary)]">Model</span>
          <Input
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            placeholder="gpt-4o-mini"
            disabled={!hasUserKey}
            className="mt-2"
            list="prompt-generator-models"
          />
          <datalist id="prompt-generator-models">
            {modelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--accent-purple)]">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Your API key</p>
            {keysLoading ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Checking connected providers...</p>
            ) : hasUserKey ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Requests will use{" "}
                <span className={cn("text-[var(--text-primary)]")}>
                  {activeKey?.displayName}
                </span>
                {" · "}
                <span className="text-[var(--text-primary)]">{selectedModel.trim() || activeKey?.defaultModel || "model not set"}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                No API key found. Add one in{" "}
                <Link href="/settings#api-keys" className="font-medium text-[var(--accent-purple)] hover:underline">
                  Settings → API Keys
                </Link>{" "}
                to generate characters from a prompt.
              </p>
            )}
          </div>
        </div>
      </div>

      {generationMeta ? (
        <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[rgb(var(--accent-rgb)_/_0.28)] bg-[var(--accent-purple-soft)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
          Generated via {generationMeta.provider.displayName} · {generationMeta.provider.model}
          {generationMeta.source === "heuristic" ? " · fallback draft" : ""}
        </div>
      ) : null}
    </section>
  );
}

function defaultModelForProvider(provider: string) {
  return MODEL_SUGGESTIONS[provider]?.[0] ?? "gpt-4o-mini";
}
