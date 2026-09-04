import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { updateUserProviderFallbacks } from "@/lib/user-keys";

const fallbackSchema = z.object({
  providers: z
    .array(
      z.object({
        provider: z.string().min(1).max(48),
        model: z.string().trim().min(1).max(160),
        enabled: z.boolean()
      })
    )
    .max(20)
});

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, fallbackSchema);
    const keys = await updateUserProviderFallbacks({
      userId: user.id,
      providers: input.providers
    });
    return json({ keys });
  } catch (error) {
    return routeError(error);
  }
}
