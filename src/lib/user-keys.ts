import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { enforceFirstClassProviderConfig, type ProviderApiFormat } from "@/lib/provider-presets";
import { defaultModelForProvider } from "@/lib/provider-model-options";

export type { ProviderApiFormat } from "@/lib/provider-presets";

export type ProviderKey = {
  id?: string;
  provider: string;
  displayName: string;
  apiFormat: ProviderApiFormat;
  apiKey: string;
  baseUrl?: string | null;
  defaultModel?: string | null;
  label?: string | null;
  isDefault?: boolean;
  fallbackEnabled?: boolean;
  fallbackPriority?: number | null;
  providerPriority?: number;
  credentialStatus?: "UNVERIFIED" | "VALID" | "INVALID";
  validatedAt?: Date | null;
  source?: "user" | "platform";
};

export type ProviderKeys = ProviderKey[];

export async function saveUserApiKey(input: {
  userId: string;
  provider: string;
  displayName?: string | null;
  apiFormat: ProviderApiFormat;
  baseUrl?: string | null;
  defaultModel?: string | null;
  apiKey: string;
  label?: string | null;
}) {
  const trimmed = input.apiKey.trim();
  const provider = normalizeProviderId(input.provider);
  const config = enforceFirstClassProviderConfig({
    provider,
    displayName: input.displayName?.trim() || providerToDisplayName(provider),
    apiFormat: input.apiFormat,
    baseUrl: input.baseUrl?.trim() || "",
    defaultModel: input.defaultModel?.trim() || ""
  });

  return prisma.$transaction(async (tx) => {
    const existingKey = await tx.userApiKey.findFirst({
      where: { userId: input.userId },
      select: { id: true }
    });
    const providerKeys = await tx.userApiKey.findMany({
      where: { userId: input.userId, provider },
      orderBy: [{ providerPriority: "asc" }, { createdAt: "asc" }],
      select: {
        providerPriority: true,
        fallbackEnabled: true,
        fallbackPriority: true
      }
    });
    const firstProviderKey = providerKeys[0];
    const isFirstKey = !existingKey;

    const providerPriority = providerKeys.reduce(
      (highest, key) => Math.max(highest, key.providerPriority),
      -1
    ) + 1;

    const key = await tx.userApiKey.create({
      data: {
        userId: input.userId,
        provider,
        displayName: config.displayName,
        apiFormat: config.apiFormat,
        baseUrl: normalizeOptionalUrl(config.baseUrl),
        defaultModel: config.defaultModel || null,
        encryptedKey: encryptSecret(trimmed),
        last4: trimmed.slice(-4),
        label: input.label?.trim() || `${config.displayName} key ${providerPriority + 1}`,
        isDefault: isFirstKey,
        fallbackEnabled: firstProviderKey?.fallbackEnabled ?? false,
        fallbackPriority: firstProviderKey?.fallbackPriority ?? null,
        providerPriority,
        credentialStatus: "VALID",
        validatedAt: new Date()
      }
    });

    if (isFirstKey) {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          preferredProvider: provider,
          preferredModel: config.defaultModel
        }
      });
    }

    return key;
  });
}

export async function listUserApiKeys(userId: string) {
  return prisma.userApiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { fallbackPriority: "asc" }, { provider: "asc" }, { providerPriority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      provider: true,
      displayName: true,
      apiFormat: true,
      baseUrl: true,
      defaultModel: true,
      label: true,
      last4: true,
      isDefault: true,
      fallbackEnabled: true,
      fallbackPriority: true,
      providerPriority: true,
      credentialStatus: true,
      validatedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function getDecryptedProviderKeys(userId: string, options: { includeInvalid?: boolean } = {}): Promise<ProviderKeys> {
  const rows = await prisma.userApiKey.findMany({
    where: {
      userId,
      ...(options.includeInvalid ? {} : { credentialStatus: { not: "INVALID" } })
    },
    orderBy: [{ isDefault: "desc" }, { fallbackPriority: "asc" }, { provider: "asc" }, { providerPriority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      provider: true,
      displayName: true,
      apiFormat: true,
      baseUrl: true,
      defaultModel: true,
      label: true,
      isDefault: true,
      fallbackEnabled: true,
      fallbackPriority: true,
      providerPriority: true,
      credentialStatus: true,
      validatedAt: true,
      encryptedKey: true
    }
  });

  const keys: ProviderKeys = [];
  const unreadableKeyIds: string[] = [];

  for (const row of rows) {
    try {
      keys.push({
        id: row.id,
        provider: row.provider,
        displayName: row.displayName,
        apiFormat: row.apiFormat as ProviderApiFormat,
        apiKey: decryptSecret(row.encryptedKey),
        baseUrl: row.baseUrl,
        defaultModel: row.defaultModel,
        label: row.label,
        isDefault: row.isDefault,
        fallbackEnabled: row.fallbackEnabled,
        fallbackPriority: row.fallbackPriority,
        providerPriority: row.providerPriority,
        credentialStatus: row.credentialStatus as ProviderKey["credentialStatus"],
        validatedAt: row.validatedAt,
        source: "user"
      });
    } catch {
      unreadableKeyIds.push(row.id);
    }
  }

  if (unreadableKeyIds.length > 0) {
    await prisma.userApiKey.updateMany({
      where: { id: { in: unreadableKeyIds }, userId },
      data: { credentialStatus: "INVALID" }
    });
  }

  return keys;
}

export async function updateUserProviderFallbacks(input: {
  userId: string;
  providers: Array<{ provider: string; model: string; enabled: boolean }>;
}) {
  const normalized = input.providers.map((item) => ({
    provider: normalizeProviderId(item.provider),
    model: item.model.trim(),
    enabled: item.enabled
  }));
  const uniqueProviders = new Set(normalized.map((item) => item.provider));
  if (
    normalized.length === 0 ||
    uniqueProviders.size !== normalized.length ||
    normalized.some((item) => !item.provider || !item.model) ||
    !normalized[0]?.enabled
  ) {
    throw new Error("Fallback providers must be unique and valid.");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.userApiKey.findMany({
      where: { userId: input.userId },
      orderBy: [{ providerPriority: "asc" }, { createdAt: "asc" }],
      select: { id: true, provider: true }
    });
    const existingProviders = new Set(existing.map((key) => key.provider));
    if (normalized.some((item) => !existingProviders.has(item.provider))) {
      throw new Error("Fallback chain contains an unknown provider.");
    }

    await tx.userApiKey.updateMany({
      where: { userId: input.userId },
      data: {
        isDefault: false,
        fallbackEnabled: false,
        fallbackPriority: null
      }
    });

    for (const [index, item] of normalized.entries()) {
      await tx.userApiKey.updateMany({
        where: { userId: input.userId, provider: item.provider },
        data: {
          defaultModel: item.model,
          fallbackEnabled: item.enabled,
          fallbackPriority: item.enabled ? index : null
        }
      });
    }

    const primary = normalized[0]!;
    const primaryKey = existing.find((key) => key.provider === primary.provider)!;
    await tx.userApiKey.update({
      where: { id: primaryKey.id },
      data: { isDefault: true }
    });
    await tx.user.update({
      where: { id: input.userId },
      data: {
        preferredProvider: primary.provider,
        preferredModel: primary.model
      }
    });
  });

  return listUserApiKeys(input.userId);
}

export async function getEffectiveProviderKeys(userId: string): Promise<ProviderKeys> {
  const userKeys = await getDecryptedProviderKeys(userId);
  const userProviders = new Set(userKeys.map((key) => key.provider));
  const serverKeys = getServerProviderKeys().filter((key) => !userProviders.has(key.provider));

  return [...userKeys, ...serverKeys];
}

export function isUserOwnedProvider(provider: string | null, keys: ProviderKeys) {
  const normalizedProvider = provider ? normalizeProviderId(provider) : "";
  const selected = normalizedProvider ? keys.find((key) => key.provider === normalizedProvider) : null;
  return Boolean(selected && selected.source !== "platform");
}

export function getServerProviderKeys(): ProviderKeys {
  const keys: ProviderKeys = [];

  if (env.OPENAI_API_KEY) {
    keys.push({
      provider: "openai",
      displayName: "Nythera OpenAI",
      apiFormat: "OPENAI",
      apiKey: env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1",
      defaultModel: defaultModelForProvider("openai"),
      source: "platform",
      fallbackEnabled: false
    });
  }

  if (env.ANTHROPIC_API_KEY) {
    keys.push({
      provider: "anthropic",
      displayName: "Nythera Anthropic",
      apiFormat: "ANTHROPIC",
      apiKey: env.ANTHROPIC_API_KEY,
      defaultModel: defaultModelForProvider("anthropic"),
      source: "platform",
      fallbackEnabled: false
    });
  }

  if (env.GEMINI_API_KEY) {
    keys.push({
      provider: "gemini",
      displayName: "Nythera Gemini",
      apiFormat: "GEMINI",
      apiKey: env.GEMINI_API_KEY,
      defaultModel: defaultModelForProvider("gemini"),
      source: "platform",
      fallbackEnabled: false
    });
  }

  return keys;
}

export async function deleteUserApiKey(input: { userId: string; keyId?: string | null; provider?: string | null }) {
  const provider = input.provider ? normalizeProviderId(input.provider) : "";

  await prisma.$transaction(async (tx) => {
    const targets = await tx.userApiKey.findMany({
      where: input.keyId
        ? { id: input.keyId, userId: input.userId }
        : { userId: input.userId, provider },
      select: { id: true, provider: true, isDefault: true }
    });
    if (targets.length === 0) {
      return;
    }
    await tx.userApiKey.deleteMany({
      where: { id: { in: targets.map((target) => target.id) }, userId: input.userId }
    });

    const deletedDefault = targets.some((target) => target.isDefault);
    if (!deletedDefault) {
      return;
    }

    const deletedDefaultProvider = targets.find((target) => target.isDefault)?.provider;
    const sameProviderReplacement = deletedDefaultProvider
      ? await tx.userApiKey.findFirst({
          where: { userId: input.userId, provider: deletedDefaultProvider },
          orderBy: [{ providerPriority: "asc" }, { createdAt: "asc" }],
          select: { id: true }
        })
      : null;
    if (sameProviderReplacement) {
      await tx.userApiKey.update({
        where: { id: sameProviderReplacement.id },
        data: { isDefault: true }
      });
      return;
    }

    const hasDefault = await tx.userApiKey.findFirst({
      where: {
        userId: input.userId,
        isDefault: true
      },
      select: { id: true }
    });

    if (hasDefault) {
      return;
    }

    const nextDefault = await tx.userApiKey.findFirst({
      where: { userId: input.userId },
      orderBy: [{ fallbackPriority: "asc" }, { provider: "asc" }, { providerPriority: "asc" }],
      select: { id: true }
    });

    if (nextDefault) {
      await tx.userApiKey.update({
        where: { id: nextDefault.id },
        data: { isDefault: true }
      });
    }
  });
}

export function normalizeProviderId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function providerToDisplayName(provider: string) {
  const known: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    gemini: "Gemini",
    openrouter: "OpenRouter",
    deepseek: "DeepSeek",
    groq: "Groq",
    together: "Together AI",
    mistral: "Mistral",
    xai: "xAI (Grok)"
  };

  return (
    known[provider] ??
    provider
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function normalizeOptionalUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}
