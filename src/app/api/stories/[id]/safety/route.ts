import { StoryContentRating } from "@prisma/client";
import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStorySafety, upsertStorySafety } from "@/lib/stories/safety-store";
import { storySafetySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    return json({ safety: await getStorySafety((await context.params).id, user.id) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:safety" });
    const input = await parseJson(request, storySafetySchema);
    return json({ safety: await upsertStorySafety((await context.params).id, user.id, {
      ...input,
      contentRating: input.contentRating as StoryContentRating
    }) });
  } catch (error) {
    return routeError(error);
  }
}
