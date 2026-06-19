import { z } from "zod";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { generateCharacterFromPrompt } from "@/lib/character-prompt-generation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDecryptedProviderKeys } from "@/lib/user-keys";

const promptSchema = z.object({
  prompt: z.string().trim().min(12).max(4000),
  provider: z.string().trim().min(1).max(48).optional(),
  model: z.string().trim().min(1).max(120).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:generate-prompt"
    });

    const input = await parseJson(request, promptSchema);
    const providerKeys = await getDecryptedProviderKeys(user.id);

    if (providerKeys.length === 0) {
      throw new HttpError(
        400,
        "Add your API key in Settings → API Keys before generating a character from a prompt."
      );
    }

    const selectedProvider = input.provider?.trim();
    if (selectedProvider && !providerKeys.some((key) => key.provider === selectedProvider)) {
      throw new HttpError(400, "Selected provider is not connected to your account.");
    }

    const generated = await generateCharacterFromPrompt({
      prompt: input.prompt,
      userId: user.id,
      providerKeys,
      provider: selectedProvider,
      model: input.model?.trim()
    });

    return json({ generated });
  } catch (error) {
    if (error instanceof HttpError) {
      return routeError(error);
    }
    return routeError(error);
  }
}