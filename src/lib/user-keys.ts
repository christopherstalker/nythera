import "server-only";

import { LlmProvider } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export type ProviderKeys = Partial<Record<"openai" | "anthropic" | "gemini", string>>;

const providerMap: Record<LlmProvider, keyof ProviderKeys> = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GEMINI: "gemini"
};

export async function saveUserApiKey(input: {
  userId: string;
  provider: LlmProvider;
  apiKey: string;
  label?: string | null;
}) {
  const trimmed = input.apiKey.trim();
  return prisma.userApiKey.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider
      }
    },
    update: {
      encryptedKey: encryptSecret(trimmed),
      last4: trimmed.slice(-4),
      label: input.label || null
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      encryptedKey: encryptSecret(trimmed),
      last4: trimmed.slice(-4),
      label: input.label || null
    }
  });
}

export async function listUserApiKeys(userId: string) {
  return prisma.userApiKey.findMany({
    where: { userId },
    orderBy: { provider: "asc" },
    select: {
      id: true,
      provider: true,
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
    select: {
      provider: true,
      encryptedKey: true
    }
  });

  const keys: ProviderKeys = {};
  for (const row of rows) {
    keys[providerMap[row.provider]] = decryptSecret(row.encryptedKey);
  }

  return keys;
}

export async function deleteUserApiKey(input: { userId: string; provider: LlmProvider }) {
  await prisma.userApiKey.deleteMany({
    where: {
      userId: input.userId,
      provider: input.provider
    }
  });
}
