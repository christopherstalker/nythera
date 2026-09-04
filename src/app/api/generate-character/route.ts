import { z } from "zod";
import { generateCharacter } from "@/lib/generation/characterGenerator";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

const schema = z.object({
  concept: z.string().trim().min(8),
  name: z.string().trim().min(2).max(80).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "characters:generate-pipeline" });
    const input = await parseJson(request, schema);
    const providerKeys = await getEffectiveProviderKeys(user.id);
    const generated = await generateCharacter(input.concept, {
      userId: user.id,
      providerKeys,
      fallbackName: input.name
    });
    return json({ generated });
  } catch (error) {
    return routeError(error instanceof HttpError ? error : error);
  }
}
