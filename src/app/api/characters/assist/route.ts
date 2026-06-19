import { z } from "zod";
import { CUSTOM_SECTION_IDS } from "@/lib/character-form-types";
import { assistCharacterSection } from "@/lib/character-section-assist";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

const assistRequestSchema = z.object({
  section: z.enum(CUSTOM_SECTION_IDS),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(5000),
  context: z.record(z.string(), z.string()).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:assist"
    });

    const input = await parseJson(request, assistRequestSchema);
    const providerKeys = await getEffectiveProviderKeys(user.id);
    const result = await assistCharacterSection({
      section: input.section,
      name: input.name,
      description: input.description,
      context: input.context,
      userId: user.id,
      providerKeys
    });

    return json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return routeError(error);
    }
    return routeError(error);
  }
}