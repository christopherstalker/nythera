import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStoryCodex, updateStoryState } from "@/lib/stories/canon-store";
import { storyStateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: Context) {
  try {
    const user = await requireUser();
    const codex = await getStoryCodex((await context.params).id, user.id);
    return json({ story: codex.story, timeline: codex.timeline, snapshot: codex.snapshot });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:state" });
    const state = await parseJson(request, storyStateSchema);
    const snapshot = await updateStoryState({ storyId: (await context.params).id, userId: user.id, state });
    return json({ snapshot });
  } catch (error) {
    return routeError(error);
  }
}
