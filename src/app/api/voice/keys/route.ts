import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { deleteVoiceApiKey, listVoiceApiKeys, saveVoiceApiKey, voiceProviderMetadata } from "@/lib/voice-keys";
import { voiceKeySchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser();
    const keys = await listVoiceApiKeys(user.id);
    return json({ keys, providers: voiceProviderMetadata() });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, voiceKeySchema);
    if (input.provider === "playht" && !input.authId?.trim()) {
      throw new HttpError(400, "PlayHT requires a User ID / auth id.");
    }

    const key = await saveVoiceApiKey({
      userId: user.id,
      provider: input.provider,
      apiKey: input.apiKey,
      authId: input.authId,
      baseUrl: input.baseUrl,
      defaultVoiceId: input.defaultVoiceId
    });

    return json({ key }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const provider = new URL(request.url).searchParams.get("provider");
    if (provider !== "elevenlabs" && provider !== "playht") {
      throw new HttpError(400, "Unsupported voice provider.");
    }

    await deleteVoiceApiKey({ userId: user.id, provider });
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
