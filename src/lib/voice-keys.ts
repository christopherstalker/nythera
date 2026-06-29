import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export type VoiceProvider = "elevenlabs" | "playht";

const VOICE_PROVIDERS: Record<VoiceProvider, { displayName: string; defaultBaseUrl: string }> = {
  elevenlabs: {
    displayName: "ElevenLabs",
    defaultBaseUrl: "https://api.elevenlabs.io/v1"
  },
  playht: {
    displayName: "PlayHT",
    defaultBaseUrl: "https://api.play.ht/api/v2"
  }
};

export async function saveVoiceApiKey(input: {
  userId: string;
  provider: VoiceProvider;
  apiKey: string;
  authId?: string | null;
  baseUrl?: string | null;
  defaultVoiceId?: string | null;
}) {
  const provider = normalizeVoiceProvider(input.provider);
  const trimmedKey = input.apiKey.trim();
  const meta = VOICE_PROVIDERS[provider];

  return prisma.voiceApiKey.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider
      }
    },
    update: {
      displayName: meta.displayName,
      encryptedKey: encryptSecret(trimmedKey),
      last4: trimmedKey.slice(-4),
      authId: input.authId?.trim() || null,
      baseUrl: normalizeOptionalUrl(input.baseUrl),
      defaultVoiceId: input.defaultVoiceId?.trim() || null
    },
    create: {
      userId: input.userId,
      provider,
      displayName: meta.displayName,
      encryptedKey: encryptSecret(trimmedKey),
      last4: trimmedKey.slice(-4),
      authId: input.authId?.trim() || null,
      baseUrl: normalizeOptionalUrl(input.baseUrl),
      defaultVoiceId: input.defaultVoiceId?.trim() || null
    },
    select: publicVoiceKeySelect()
  });
}

export async function listVoiceApiKeys(userId: string) {
  return prisma.voiceApiKey.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { provider: "asc" }],
    select: publicVoiceKeySelect()
  });
}

export async function deleteVoiceApiKey(input: { userId: string; provider: VoiceProvider }) {
  await prisma.voiceApiKey.deleteMany({
    where: {
      userId: input.userId,
      provider: normalizeVoiceProvider(input.provider)
    }
  });
}

export async function getDecryptedVoiceApiKey(userId: string, provider: VoiceProvider) {
  const row = await prisma.voiceApiKey.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: normalizeVoiceProvider(provider)
      }
    }
  });

  if (!row) {
    throw new HttpError(404, "Voice API key not found.");
  }

  return {
    provider: row.provider as VoiceProvider,
    displayName: row.displayName,
    apiKey: decryptSecret(row.encryptedKey),
    authId: row.authId,
    baseUrl: row.baseUrl || VOICE_PROVIDERS[row.provider as VoiceProvider].defaultBaseUrl,
    defaultVoiceId: row.defaultVoiceId
  };
}

export function normalizeVoiceProvider(provider: string): VoiceProvider {
  if (provider === "elevenlabs" || provider === "playht") {
    return provider;
  }
  throw new HttpError(400, "Unsupported voice provider.");
}

export function voiceProviderMetadata() {
  return VOICE_PROVIDERS;
}

function publicVoiceKeySelect() {
  return {
    id: true,
    provider: true,
    displayName: true,
    authId: true,
    baseUrl: true,
    defaultVoiceId: true,
    last4: true,
    createdAt: true,
    updatedAt: true
  };
}

function normalizeOptionalUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}
