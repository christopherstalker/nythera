"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ListOrdered, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultModelForProvider, modelSuggestionsForProvider } from "@/lib/provider-model-options";
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
  providerPriority?: number;
  credentialStatus?: "UNVERIFIED" | "VALID" | "INVALID";
};

type ApiFormat = ProviderApiFormat;

type ModelCatalogEntry = {
  keyId?: string;
  keyLabel?: string | null;
  last4?: string;
  provider: string;
  models: string[];
  source: "live" | "fallback";
  refreshedAt: string;
  balanceAvailable?: boolean;
  warning?: string;
};

const MODEL_CATALOG_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const providers = FIRST_CLASS_PROVIDER_PRESETS;
const blankCustomProvider = {
  provider: "",
  displayName: "",
  apiFormat: "OPENAI_COMPATIBLE" as ApiFormat,
  baseUrl: "",
  defaultModel: "",
  apiKey: "",
  label: ""
};

export function KeySettingsClient({ onboarding = false, callbackUrl = "/explore" }: { onboarding?: boolean; callbackUrl?: string }) {
  const { status: sessionStatus } = useSession();
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState(blankCustomProvider);
  const [status, setStatus] = useState<string | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogEntry[]>([]);
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState("");
  const [savingOutputLimit, setSavingOutputLimit] = useState(false);
  const catalogRefreshInFlightRef = useRef(false);
  const lastCatalogRefreshRef = useRef(0);

  const refreshModels = useCallback(async (force: boolean) => {
    if (catalogRefreshInFlightRef.current) return;
    catalogRefreshInFlightRef.current = true;
    setModelCatalogLoading(true);
    try {
      const response = await fetch(`/api/keys/models${force ? "?refresh=1" : ""}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(body?.error ?? "Could not refresh provider models.");
        return;
      }
      const entries: ModelCatalogEntry[] = Array.isArray(body?.providers) ? body.providers : [];
      setModelCatalog(entries);
      lastCatalogRefreshRef.current = Date.now();
      const warning = entries.find((entry) => entry.warning)?.warning;
      const availableModelCount = new Set(entries.flatMap((entry) => entry.models.map((model) => `${entry.provider}:${model}`))).size;
      setStatus(warning ?? (availableModelCount > 0
        ? `Live catalog updated: ${availableModelCount} available models.`
        : "Connect a provider to load its available models."));
    } catch {
      setStatus("Could not reach the model catalog. Bundled models remain available.");
    } finally {
      catalogRefreshInFlightRef.current = false;
      setModelCatalogLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/keys");
    if (!response.ok) {
      setStatus("Sign in to manage model keys.");
      return;
    }

    const body = await response.json();
    setKeys(body.keys ?? []);
    setMaxOutputTokens(typeof body.maxOutputTokens === "number" ? String(body.maxOutputTokens) : "");
    await refreshModels(false);
  }, [refreshModels]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void refresh();
      return;
    }

    if (sessionStatus === "unauthenticated") {
      setStatus("Sign in to manage model keys.");
    }
  }, [refresh, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    const refreshIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCatalogRefreshRef.current >= MODEL_CATALOG_REFRESH_INTERVAL_MS) {
        void refreshModels(false);
      }
    };
    const intervalId = window.setInterval(refreshIfStale, MODEL_CATALOG_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [refreshModels, sessionStatus]);

  const savedByProvider = useMemo(() => {
    const grouped = new Map<string, SavedKey[]>();
    for (const key of keys) {
      const providerKeys = grouped.get(key.provider) ?? [];
      providerKeys.push(key);
      grouped.set(key.provider, providerKeys);
    }
    return grouped;
  }, [keys]);
  const orderedProviders = useMemo(
    () => [...providers].sort((left, right) => Number(savedByProvider.has(right.provider)) - Number(savedByProvider.has(left.provider))),
    [savedByProvider]
  );
  const catalogByKey = useMemo(
    () => new Map(modelCatalog.filter((entry) => entry.keyId).map((entry) => [entry.keyId!, entry])),
    [modelCatalog]
  );
  const rejectedProviders = useMemo(
    () => new Set(Array.from(savedByProvider)
      .filter(([, providerKeys]) => providerKeys.every((key) => key.credentialStatus === "INVALID"))
      .map(([provider]) => provider)),
    [savedByProvider]
  );
  const verifiedKeyCount = keys.filter((key) => key.credentialStatus === "VALID").length;
  const fallbackKeys = useMemo(() => Array.from(savedByProvider.values()).map((providerKeys) => providerKeys[0]), [savedByProvider]);
  const fallbackModels = useMemo(() => {
    const modelsByProvider = new Map<string, string[]>();
    for (const key of fallbackKeys) {
      const discovered = modelCatalog
        .filter((entry) => entry.provider === key.provider)
        .flatMap((entry) => entry.models);
      modelsByProvider.set(
        key.provider,
        modelSuggestionsForProvider(key.provider, key.defaultModel, discovered)
      );
    }
    return modelsByProvider;
  }, [fallbackKeys, modelCatalog]);
  const customError = validateCustomProvider(custom);
  const customStarted = Boolean(custom.provider || custom.displayName || custom.baseUrl || custom.defaultModel || custom.apiKey || custom.label);

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
        label: labels[providerName]?.trim() || undefined
      })
    });

    setSaving((current) => ({ ...current, [providerName]: false }));

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? `Could not save ${config.displayName} key.`);
      return;
    }

    setValues((current) => ({ ...current, [providerName]: "" }));
    setLabels((current) => ({ ...current, [providerName]: "" }));
    setStatus(`${config.displayName} key verified and added to its failover pool.`);
    await refresh();
  }

  async function remove(keyId: string) {
    await fetch(`/api/keys?id=${encodeURIComponent(keyId)}`, { method: "DELETE" });
    await refresh();
  }

  async function saveCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customError) {
      setStatus(customError);
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
        label: custom.label.trim() || undefined
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
    if (target < 0 || target >= fallbackKeys.length) {
      return;
    }
    setKeys((current) => {
      const providerOrder = fallbackKeys.map((key) => key.provider);
      [providerOrder[index], providerOrder[target]] = [providerOrder[target], providerOrder[index]];
      const primaryProvider = providerOrder[0];
      return providerOrder.flatMap((provider) =>
        current
          .filter((key) => key.provider === provider)
          .map((key, keyIndex) => ({
            ...key,
            isDefault: provider === primaryProvider && keyIndex === 0,
            fallbackEnabled: provider === primaryProvider ? true : key.fallbackEnabled
          }))
      );
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

  function selectFallbackModel(provider: string, model: string) {
    setKeys((current) => current.map((key) =>
      key.provider === provider ? { ...key, defaultModel: model } : key
    ));
  }

  async function saveFallbackChain() {
    setStatus(null);
    const response = await fetch("/api/keys/fallback", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: fallbackKeys.map((key) => ({
          provider: key.provider,
          model: key.defaultModel?.trim() || defaultModelForProvider(key.provider),
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

  async function saveOutputTokenLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedLimit = maxOutputTokens.trim() ? Number(maxOutputTokens) : null;
    if (parsedLimit !== null && (!Number.isInteger(parsedLimit) || parsedLimit < 128 || parsedLimit > 4096)) {
      setStatus("Maximum output tokens must be a whole number from 128 to 4096.");
      return;
    }

    setSavingOutputLimit(true);
    setStatus(null);
    try {
      const response = await fetch("/api/keys", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxOutputTokens: parsedLimit })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(body?.error ?? "Could not save the output token limit.");
        return;
      }
      setMaxOutputTokens(typeof body.maxOutputTokens === "number" ? String(body.maxOutputTokens) : "");
      setStatus(body.maxOutputTokens
        ? `Maximum output set to ${body.maxOutputTokens.toLocaleString()} tokens.`
        : "Automatic output limits restored.");
    } catch {
      setStatus("Could not reach the server. Try saving the output limit again.");
    } finally {
      setSavingOutputLimit(false);
    }
  }

  return (
    <div className="grid gap-4">
      {onboarding ? (
        <section className="glass-card border-[var(--accent-purple)]/40 p-5" aria-labelledby="provider-onboarding-title">
          <p className="codex-kicker text-[var(--accent-purple)]">First connection</p>
          <h3 id="provider-onboarding-title" className="mt-2 font-editorial text-3xl text-[var(--text-primary)]">Connect a model before you enter a story.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Nythera does not bundle a paid model account. Add one provider key below; it is verified before it is stored.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {verifiedKeyCount > 0 ? (
              <Button asChild><Link href={callbackUrl}>Continue to Nythera</Link></Button>
            ) : (
              <Button type="button" disabled>Connect a provider to continue</Button>
            )}
            <span className="text-xs text-[var(--text-muted)]">You can add or switch providers later.</span>
          </div>
        </section>
      ) : null}
      <form onSubmit={saveOutputTokenLimit} className="glass-card p-4" aria-labelledby="output-token-limit-title">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] sm:items-end">
          <div>
            <h3 id="output-token-limit-title" className="text-sm font-semibold text-[var(--text-primary)]">Maximum output tokens</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Set the hard ceiling for each model response. Leave it empty to use Nythera&apos;s automatic Short, Medium, and Long limits.
            </p>
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Tokens per response</span>
            <Input
              type="number"
              min={128}
              max={4096}
              step={64}
              value={maxOutputTokens}
              onChange={(event) => setMaxOutputTokens(event.target.value)}
              placeholder="Automatic"
              inputMode="numeric"
            />
          </label>
          <Button type="submit" disabled={savingOutputLimit}>
            <Save className="h-4 w-4" />
            {savingOutputLimit ? "Saving..." : "Save limit"}
          </Button>
        </div>
      </form>
      <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Live model catalog</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Available models refresh automatically from each connected provider. Bundled models are used only if a provider cannot be reached.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={modelCatalogLoading} onClick={() => void refreshModels(true)}>
          <RefreshCw className={`h-4 w-4 ${modelCatalogLoading ? "animate-spin" : ""}`} />
          Refresh models
        </Button>
      </div>
      {keys.length > 0 ? (
        <section className="glass-card p-4">
          <div className="flex items-start gap-3">
            <ListOrdered className="mt-0.5 h-5 w-5 text-[var(--accent-purple)]" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Fallback chain</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Move any provider to the first position to make it primary, then choose the exact model for every step. Failed keys advance to the next saved key; invalid requests still stop immediately.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {fallbackKeys.map((key, index) => (
              <div key={key.provider} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                <input
                  type="checkbox"
                  checked={key.isDefault || key.fallbackEnabled}
                  disabled={key.isDefault || rejectedProviders.has(key.provider)}
                  onChange={() => toggleFallback(key.provider)}
                  aria-label={`Include ${key.displayName} in fallback chain`}
                  className="accent-[var(--accent-purple)]"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {index + 1}. {key.displayName} {key.isDefault ? "(primary)" : ""}{rejectedProviders.has(key.provider) ? " · invalid key" : ""}
                  </p>
                  <select
                    value={key.defaultModel?.trim() || defaultModelForProvider(key.provider)}
                    onChange={(event) => selectFallbackModel(key.provider, event.target.value)}
                    aria-label={`Model for ${key.displayName}`}
                    className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-purple)]"
                  >
                    {(fallbackModels.get(key.provider) ?? [key.defaultModel?.trim() || defaultModelForProvider(key.provider)]).map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label={`Move ${key.displayName} up`} onClick={() => moveFallback(index, -1)} disabled={index === 0 || (index === 1 && rejectedProviders.has(key.provider))}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" aria-label={`Move ${key.displayName} down`} onClick={() => moveFallback(index, 1)} disabled={index === fallbackKeys.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" className="mt-3" onClick={() => void saveFallbackChain()}>
            <Save className="h-4 w-4" />
            Save fallback chain
          </Button>
        </section>
      ) : null}
      {orderedProviders.map((provider) => {
        const savedKeys = savedByProvider.get(provider.provider) ?? [];
        const liveCatalog = savedKeys.map((key) => catalogByKey.get(key.id)).find((entry) => entry?.source === "live");
        const value = values[provider.provider] ?? "";
        const label = labels[provider.provider] ?? "";
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
                  {savedKeys.length > 0 ? `${savedKeys.length} saved ${savedKeys.length === 1 ? "key" : "keys"} · tried in the order shown` : "No key saved"}
                </p>
                {liveCatalog ? (
                  <div className="mt-1 text-xs text-[var(--codex-mint)]">
                    <p>
                      {liveCatalog.models.length} models · live catalog · {formatCatalogRefresh(liveCatalog.refreshedAt)}
                      {liveCatalog.balanceAvailable === false ? " · no DeepSeek balance" : ""}
                    </p>
                    <details className="mt-2 text-[var(--text-muted)]">
                      <summary className="cursor-pointer select-none font-medium text-[var(--text-secondary)]">View available models</summary>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {liveCatalog.models.map((model) => (
                          <code key={model} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">{model}</code>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : null}
              </div>
            </div>

            {savedKeys.length > 0 ? (
              <div className="mt-4 grid gap-2" aria-label={`${provider.displayName} failover keys`}>
                {savedKeys.map((key, index) => {
                  const catalog = catalogByKey.get(key.id);
                  const rejected = key.credentialStatus === "INVALID" || isRejectedCredential(catalog?.warning);
                  const keyName = key.label || `${provider.displayName} key ${index + 1}`;
                  return (
                    <div key={key.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3 shadow-[var(--glass-highlight)]">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-xs font-semibold text-[var(--text-secondary)]">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{keyName}</p>
                        <p className={`mt-1 truncate text-xs ${rejected ? "text-amber-300" : "text-[var(--text-muted)]"}`}>
                          {rejected ? "Invalid" : key.credentialStatus === "VALID" ? "Verified" : "Unverified"} · ending in {key.last4}
                        </p>
                        {catalog?.warning ? <p className="mt-1 text-xs leading-5 text-amber-300" role="status">{catalog.warning}</p> : null}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => remove(key.id)} aria-label={`Remove ${keyName}`}>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <Input
              value={label}
              onChange={(event) => setLabels((current) => ({ ...current, [provider.provider]: event.target.value }))}
              placeholder={`Label, e.g. ${provider.displayName} backup`}
              maxLength={80}
              className="mt-4 sm:max-w-sm"
            />
            <div className="mt-2 grid grid-cols-[repeat(3,2.5rem)] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
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
              {saving[provider.provider] ? "Verifying..." : savedKeys.length > 0 ? "Verify and add backup key" : "Verify and add key"}
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
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{key.label || key.displayName}</p>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{key.displayName} · {key.provider} · {key.defaultModel || "no default model"} · ending in {key.last4}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => remove(key.id)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ) : null}


      <form onSubmit={saveCustom} className="glass-card p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add custom provider endpoint</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          Save multiple named endpoints such as My Ollama, LM Studio, or vLLM. OpenRouter has a dedicated key-only card above. After setup, chats pick providers from the model switcher without raw URL typing.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Input value={custom.provider} onChange={(event) => setCustom((current) => ({ ...current, provider: event.target.value }))} placeholder="Unique provider ID, e.g. my-ollama" aria-invalid={Boolean(custom.provider) && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,47}$/.test(custom.provider)} />
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
          <Input value={custom.baseUrl} onChange={(event) => setCustom((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="Base URL, e.g. http://localhost:11434/v1" className="sm:col-span-2" aria-invalid={Boolean(custom.baseUrl) && !isHttpUrl(custom.baseUrl)} />
          <Input value={custom.label} onChange={(event) => setCustom((current) => ({ ...current, label: event.target.value }))} placeholder="Key label, e.g. Backup account" className="sm:col-span-2" maxLength={80} />
          <Input value={custom.apiKey} onChange={(event) => setCustom((current) => ({ ...current, apiKey: event.target.value }))} type="password" placeholder="API key" className="sm:col-span-2" autoComplete="off" />
        </div>
        {customStarted && customError ? <p className="mt-3 text-xs leading-5 text-amber-300" role="alert">{customError}</p> : null}
        <Button type="submit" className="mt-3" disabled={Boolean(customError)}>
          <Save className="h-4 w-4" />
          Verify and save custom endpoint
        </Button>
      </form>

      {status ? <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">{status}</p> : null}
    </div>
  );
}

function isRejectedCredential(warning?: string | null) {
  return Boolean(warning?.toLowerCase().includes("rejected this api key"));
}

function validateCustomProvider(provider: typeof blankCustomProvider) {
  if (!provider.provider.trim()) return "Enter a unique provider ID.";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,47}$/.test(provider.provider.trim())) {
    return "Provider IDs may contain 2–48 letters, numbers, hyphens, or underscores.";
  }
  if (!provider.displayName.trim()) return "Enter a display name.";
  if (!provider.defaultModel.trim()) return "Enter the provider's default model.";
  if (!provider.baseUrl.trim() || !isHttpUrl(provider.baseUrl)) return "Enter a valid HTTP or HTTPS base URL.";
  if (provider.apiKey.trim().length < 6) return "Enter an API key with at least 6 characters.";
  return null;
}

function formatCatalogRefresh(value: string) {
  const refreshedAt = new Date(value);
  if (Number.isNaN(refreshedAt.getTime())) return "refresh time unavailable";
  return `updated ${refreshedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
