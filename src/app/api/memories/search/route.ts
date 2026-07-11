import { z } from "zod";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { searchMemories } from "@/lib/vector";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

const memorySearchSchema = z.object({
  query: z.string().min(1).max(2000),
  characterId: z.string().optional(),
  limit: z.coerce.number().min(1).max(20).default(5)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "memories:search"
    });

    const input = await parseJson(request, memorySearchSchema);

    if (!input.query.trim()) {
      throw new HttpError(400, "query is required.");
    }

    const providerKeys = await getEffectiveProviderKeys(user.id);
    const memories = await searchMemories({
      userId: user.id,
      characterId: input.characterId,
      query: input.query,
      limit: input.limit,
      providerKeys
    });

    return json({ memories });
  } catch (error) {
    return routeError(error);
  }
}
