import "server-only";

import { createHash } from "node:crypto";
import { modelSuggestionsForProvider } from "@/lib/provider-model-options";
import { redis } from "@/lib/redis";
import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url";
import { logSafeError } from "@/lib/secret-redaction";
import type { ProviderKey } from "@/lib/user-keys";

const MODEL_CATALOG_TTL_SECONDS = 15 * 60;
const MODEL_CATALOG_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const MODEL_DISCOVERY_TIMEOUT_MS = 12_000;
const memoryCatalog = new Map<string, { retainedUntil: number; value: ProviderModelDiscovery }>();

export type ProviderModelDiscovery = {
  provider: string;
  models: string[];
  source: "live" | "fallback";
  refreshedAt: string;
  balanceAvailable?: boolean;
  warning?: string;
};

export type ProviderCredentialValidation =
  | { ok: true; catalog: ProviderModelDiscovery }
  | { ok: false; message: string; status: number };

export async function validateProviderCredentials(key: ProviderKey): Promise<ProviderCredentialValidation> {
  try {
    return { ok: true, catalog: await fetchLiveCatalog(key) };
  } catch (error) {
    const providerStatus = readErrorStatus(error);
    return {
      ok: false,
      message: credentialValidationMessage(error),
      status: providerStatus === 429 ? 429 : providerStatus === 400 || providerStatus === 401 || providerStatus === 403 || providerStatus === 402 ? 400 : 502
    };
  }
}

export async function discoverProviderModels(key: ProviderKey, options: { force?: boolean } = {}): Promise<ProviderModelDiscovery> {
  const cacheKey = catalogCacheKey(key);
  const cached = await readCachedCatalog(cacheKey);
  if (!options.force && cached && isFreshCatalog(cached)) {
    return cached;
  }

  try {
    const live = await fetchLiveCatalog(key);
    await writeCachedCatalog(cacheKey, live);
    return live;
  } catch (error) {
    logSafeError(`Model discovery failed for ${key.provider}; keeping the last usable catalog.`, error);
    if (cached) {
      return {
        ...cached,
        warning: `${safeDiscoveryWarning(error)} Showing the last successful live catalog.`
      };
    }
    return {
      provider: key.provider,
      models: modelSuggestionsForProvider(key.provider, key.defaultModel),
      source: "fallback",
      refreshedAt: new Date().toISOString(),
      warning: safeDiscoveryWarning(error)
    };
  }
}

export function normalizeGeminiModels(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("models" in payload) || !Array.isArray(payload.models)) {
    return [];
  }

  return uniqueSorted(
    payload.models.flatMap((model) => {
      if (!model || typeof model !== "object") return [];
      const name = "name" in model && typeof model.name === "string" ? model.name.replace(/^models\//, "") : "";
      const methods = "supportedGenerationMethods" in model && Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods
        : [];
      return name && methods.includes("generateContent") && isTextChatModel(name) ? [name] : [];
    })
  );
}

export function normalizeOpenAiCompatibleModels(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    return [];
  }

  return uniqueSorted(
    payload.data.flatMap((model) =>
      model && typeof model === "object" && "id" in model && typeof model.id === "string" && isTextChatModel(model.id)
        ? [model.id]
        : []
    )
  );
}

async function fetchLiveCatalog(key: ProviderKey): Promise<ProviderModelDiscovery> {
  const refreshedAt = new Date().toISOString();
  if (key.apiFormat === "GEMINI" || key.provider === "gemini") {
    const payload = await fetchProviderJson(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      { "x-goog-api-key": key.apiKey }
    );
    return requireModels(key.provider, normalizeGeminiModels(payload), refreshedAt);
  }

  if (key.apiFormat === "ANTHROPIC" || key.provider === "anthropic") {
    const payload = await fetchProviderJson("https://api.anthropic.com/v1/models?limit=1000", {
      "x-api-key": key.apiKey,
      "anthropic-version": "2023-06-01"
    });
    return requireModels(key.provider, normalizeOpenAiCompatibleModels(payload), refreshedAt);
  }

  const baseUrl = key.baseUrl || (key.apiFormat === "OPENAI" ? "https://api.openai.com/v1" : "");
  if (!baseUrl) {
    throw new Error("The provider does not expose a model catalog URL.");
  }
  const safeBaseUrl = await assertSafeOutboundUrl(baseUrl);
  if (key.provider === "openrouter") {
    await fetchProviderJson(`${safeBaseUrl.replace(/\/+$/, "")}/auth/key`, {
      authorization: `Bearer ${key.apiKey}`
    });
  }
  const modelsPayload = await fetchProviderJson(`${safeBaseUrl.replace(/\/+$/, "")}/models`, {
    authorization: `Bearer ${key.apiKey}`
  });
  const discovery = requireModels(key.provider, normalizeOpenAiCompatibleModels(modelsPayload), refreshedAt);

  if (key.provider === "deepseek") {
    const balancePayload = await fetchProviderJson(`${safeBaseUrl.replace(/\/+$/, "")}/user/balance`, {
      authorization: `Bearer ${key.apiKey}`
    });
    discovery.balanceAvailable = readBalanceAvailability(balancePayload);
    if (discovery.balanceAvailable === false) {
      discovery.warning = "DeepSeek accepted the key, but the account has no available API balance.";
    }
  }

  return discovery;
}

async function fetchProviderJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(MODEL_DISCOVERY_TIMEOUT_MS)
  });
  if (!response.ok) {
    const error = new Error(`Provider model discovery returned HTTP ${response.status}.`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<unknown>;
}

function requireModels(provider: string, models: string[], refreshedAt: string): ProviderModelDiscovery {
  if (models.length === 0) {
    throw new Error("The provider returned no compatible text models.");
  }
  return { provider, models, source: "live", refreshedAt };
}

function readBalanceAvailability(payload: unknown) {
  return payload && typeof payload === "object" && "is_available" in payload && typeof payload.is_available === "boolean"
    ? payload.is_available
    : undefined;
}

function isTextChatModel(model: string) {
  return !/(embedding|image|imagen|veo|tts|audio|live|aqa|robotics|computer-use)/i.test(model);
}

function uniqueSorted(models: string[]) {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function catalogCacheKey(key: ProviderKey) {
  const fingerprint = createHash("sha256")
    .update(`${key.provider}\0${key.apiFormat}\0${key.baseUrl ?? ""}\0${key.apiKey}`)
    .digest("hex")
    .slice(0, 32);
  return `provider-models:v1:${key.provider}:${fingerprint}`;
}

async function readCachedCatalog(cacheKey: string) {
  const memory = memoryCatalog.get(cacheKey);
  if (memory?.retainedUntil && memory.retainedUntil > Date.now()) return memory.value;
  memoryCatalog.delete(cacheKey);
  if (!redis) return null;
  try {
    const cached = await redis.get<ProviderModelDiscovery>(cacheKey);
    if (cached) {
      memoryCatalog.set(cacheKey, {
        value: cached,
        retainedUntil: Date.now() + MODEL_CATALOG_RETENTION_SECONDS * 1000
      });
    }
    return cached;
  } catch (error) {
    logSafeError("Provider model catalog cache read failed.", error);
    return null;
  }
}

async function writeCachedCatalog(cacheKey: string, value: ProviderModelDiscovery) {
  memoryCatalog.set(cacheKey, {
    value,
    retainedUntil: Date.now() + MODEL_CATALOG_RETENTION_SECONDS * 1000
  });
  if (!redis) return;
  try {
    await redis.set(cacheKey, value, { ex: MODEL_CATALOG_RETENTION_SECONDS });
  } catch (error) {
    logSafeError("Provider model catalog cache write failed.", error);
  }
}

function isFreshCatalog(catalog: ProviderModelDiscovery) {
  const refreshedAt = Date.parse(catalog.refreshedAt);
  return Number.isFinite(refreshedAt) && Date.now() - refreshedAt < MODEL_CATALOG_TTL_SECONDS * 1000;
}

function safeDiscoveryWarning(error: unknown) {
  const status = readErrorStatus(error);
  if (status === 400 || status === 401 || status === 403) return "The provider rejected this API key while refreshing models.";
  if (status === 402) return "The provider reports insufficient API balance.";
  if (status === 429) return "The provider rate-limited model discovery; cached models remain available.";
  return "Live model refresh failed; using bundled fallback models.";
}

function credentialValidationMessage(error: unknown) {
  const status = readErrorStatus(error);
  if (status === 400 || status === 401 || status === 403) return "The provider rejected this API key. It was not saved.";
  if (status === 402) return "The provider reports insufficient API balance. The key was not saved.";
  if (status === 429) return "The provider rate-limited key verification. The key was not saved; retry shortly.";
  return "Nythera could not verify this key with the provider. It was not saved.";
}

function readErrorStatus(error: unknown) {
  return error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
}
