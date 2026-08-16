import OpenAI from "openai";
import { HttpError, getRequestIp, json, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "voice:transcribe" });
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0 || audio.size > 15 * 1024 * 1024 || !audio.type.startsWith("audio/")) throw new HttpError(400, "Choose an audio clip under 15MB.");
    const key = (await getEffectiveProviderKeys(user.id)).find((candidate) => candidate.provider === "openai");
    if (!key) throw new HttpError(400, "Add an OpenAI key to transcribe voice messages.");
    const client = new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl || undefined });
    const transcript = await client.audio.transcriptions.create({ file: audio, model: "whisper-1" });
    const durationHint = Number(form.get("duration") || 0);
    const energy = Number(form.get("energy") || 0);
    const emotion = energy > 0.35 ? "intense" : energy < 0.12 || durationHint > 20 ? "soft" : "steady";
    return json({ text: transcript.text, emotion });
  } catch (error) { return routeError(error); }
}
