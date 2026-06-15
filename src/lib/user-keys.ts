import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type ProviderApiFormat = "OPENAI" | "ANTHROPIC" | "GEMINI" | "OPENAI_COMPATIBLE";

export type ProviderKey = {
  provider: string;
  displayName: string;
  apiFormat: ProviderApiFormat;
  apiKey: string;
  baseUrl?: string | null;
  defaultModel?: string | null;
  label?: string | null;
  isDefault?: boolean;
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
  const displayName = input.displayName?.trim() || providerToDisplayName(provider);

  return prisma.$transaction(async (tx) => {
    await tx.userApiKey.updateMany({
      where: {
        userId: input.userId,
        provider: { not: provider }
      },
      data: { isDefault: false }
    });

    return tx.userApiKey.upsert({
      where: {
        userId_provider: {
          userId: input.userId,
          provider
        }
      },
      update: {
        displayName,
        apiFormat: input.apiFormat,
        baseUrl: normalizeOptionalUrl(input.baseUrl),
        defaultModel: input.defaultModel?.trim() || null,
        encryptedKey: encryptSecret(trimmed),
        last4: trimmed.slice(-4),
        label: input.label || null,
        isDefault: true
      },
      create: {
        userId: input.userId,
        provider,
        displayName,
        apiFormat: input.apiFormat,
        baseUrl: normalizeOptionalUrl(input.baseUrl),
        defaultModel: input.defaultModel?.trim() || null,
        encryptedKey: encryptSecret(trimmed),
        last4: trimmed.slice(-4),
        label: input.label || null,
        isDefault: true
      }
    });
  });
}

export async function listUserApiKeys(userId: string) {
  return prisma.userApiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }, { provider: "asc" }],
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
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function getDecryptedProviderKeys(userId: string): Promise<ProviderKeys> {
  const rows = await prisma.userApiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      provider: true,
      displayName: true,
      apiFormat: true,
      baseUrl: true,
      defaultModel: true,
      label: true,
      isDefault: true,
      encryptedKey: true
    }
  });

  return rows.map((row) => ({
    provider: row.provider,
    displayName: row.displayName,
    apiFormat: row.apiFormat as ProviderApiFormat,
    apiKey: decryptSecret(row.encryptedKey),
    baseUrl: row.baseUrl,
    defaultModel: row.defaultModel,
    label: row.label,
    isDefault: row.isDefault
  }));
}

export async function getEffectiveProviderKeys(userId: string): Promise<ProviderKeys> {
  const userKeys = await getDecryptedProviderKeys(userId);
  const userProviders = new Set(userKeys.map((key) => key.provider));
  const serverKeys = getServerProviderKeys().filter((key) => !userProviders.has(key.provider));

  return [...userKeys, ...serverKeys];
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
      defaultModel: "gpt-4o-mini"
    });
  }

  if (env.ANTHROPIC_API_KEY) {
    keys.push({
      provider: "anthropic",
      displayName: "Nythera Anthropic",
      apiFormat: "ANTHROPIC",
      apiKey: env.ANTHROPIC_API_KEY,
      defaultModel: "claude-3-5-sonnet-latest"
    });
  }

  if (env.GEMINI_API_KEY) {
    keys.push({
      provider: "gemini",
      displayName: "Nythera Gemini",
      apiFormat: "GEMINI",
      apiKey: env.GEMINI_API_KEY,
      defaultModel: "gemini-2.5-flash"
    });
  }

  return keys;
}

export async function deleteUserApiKey(input: { userId: string; provider: string }) {
  const provider = normalizeProviderId(input.provider);

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.userApiKey.deleteMany({
      where: {
        userId: input.userId,
        provider
      }
    });

    if (deleted.count === 0) {
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
      orderBy: [{ updatedAt: "desc" }, { provider: "asc" }],
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
    mistral: "Mistral"
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
