import { HttpError, getRequestIp, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText, isMinorBirthDate } from "@/lib/safety";
import { parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getDecryptedVoiceApiKey, type VoiceProvider } from "@/lib/voice-keys";
import { voiceSynthesisSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DEFAULT_ELEVENLABS_VOICE = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_PLAYHT_VOICE = "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/original/manifest.json";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "voice:synthesize"
    });

    const input = await parseJson(request, voiceSynthesisSchema);
    const text = sanitizeUserText(input.text, 2500);
    const moderation = moderateText({
      text,
      userIsMinor: isMinorBirthDate(user.birthDate),
      context: "assistant"
    });
    if (!moderation.allowed) {
      throw new HttpError(400, moderation.reason ?? "Text is blocked by the platform safety policy.");
    }

    let provider: VoiceProvider = input.provider;
    let voiceId = input.voiceId;
    let speed = 1;
    if (input.storyId && input.characterId) {
      const binding = await prisma.storyVoiceBinding.findFirst({
        where: {
          storyId: input.storyId,
          story: { ownerId: user.id },
          participant: { characterId: input.characterId }
        },
        select: { provider: true, voiceId: true, speed: true }
      });
      if (binding) {
        provider = binding.provider === "playht" ? "playht" : "elevenlabs";
        voiceId = input.voiceId || binding.voiceId;
        speed = binding.speed;
      }
    }

    const key = await getDecryptedVoiceApiKey(user.id, provider);
    const response = provider === "elevenlabs"
      ? await synthesizeElevenLabs({
          apiKey: key.apiKey,
          baseUrl: key.baseUrl,
          voiceId: voiceId || key.defaultVoiceId || DEFAULT_ELEVENLABS_VOICE,
          text,
          speed
        })
      : await synthesizePlayHt({
          apiKey: key.apiKey,
          userId: key.authId,
          baseUrl: key.baseUrl,
          voiceId: voiceId || key.defaultVoiceId || DEFAULT_PLAYHT_VOICE,
          text,
          format: input.format,
          speed
        });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      throw new HttpError(response.status || 502, detail.slice(0, 300) || "Voice provider request failed.");
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") || (input.format === "wav" ? "audio/wav" : "audio/mpeg"),
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

async function synthesizeElevenLabs(input: {
  apiKey: string;
  baseUrl: string;
  voiceId: string;
  text: string;
  speed: number;
}) {
  const url = `${input.baseUrl.replace(/\/+$/, "")}/text-to-speech/${encodeURIComponent(input.voiceId)}`;
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "audio/mpeg",
      "xi-api-key": input.apiKey
    },
    body: JSON.stringify({
      text: input.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { speed: Math.max(0.7, Math.min(1.2, input.speed)) }
    })
  });
}

async function synthesizePlayHt(input: {
  apiKey: string;
  userId?: string | null;
  baseUrl: string;
  voiceId: string;
  text: string;
  format: "mp3" | "wav";
  speed: number;
}) {
  if (!input.userId) {
    throw new HttpError(400, "PlayHT requires a User ID / auth id.");
  }

  const url = `${input.baseUrl.replace(/\/+$/, "")}/tts/stream`;
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: input.format === "wav" ? "audio/wav" : "audio/mpeg",
      authorization: `Bearer ${input.apiKey}`,
      "x-user-id": input.userId
    },
    body: JSON.stringify({
      text: input.text,
      voice: input.voiceId,
      output_format: input.format,
      speed: input.speed
    })
  });
}
