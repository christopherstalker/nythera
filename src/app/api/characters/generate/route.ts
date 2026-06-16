import { z } from "zod";
import { generateCharacterFromDescription } from "@/lib/character-generation";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

const generateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(2000)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:generate"
    });

    const input = await parseJson(request, generateSchema);
    const providerKeys = await getEffectiveProviderKeys(user.id);
    const generated = await generateCharacterFromDescription({
      name: input.name,
      description: input.description,
      userId: user.id,
      providerKeys
    });

    return json({ generated });
  } catch (error) {
    if (error instanceof HttpError) {
      return routeError(error);
    }
    return routeError(error);
  }
}
