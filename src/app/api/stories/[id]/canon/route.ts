import { StoryFactScope, StoryFactStatus, StoryKnowledgeState } from "@prisma/client";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createStoryFact, getStoryCodex, updateStoryFact } from "@/lib/stories/canon-store";
import { storyFactCreateSchema, storyFactUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const timelineId = new URL(request.url).searchParams.get("timelineId");
    return json(await getStoryCodex((await context.params).id, user.id, timelineId));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:canon" });
    const input = await parseJson(request, storyFactCreateSchema);
    const fact = await createStoryFact((await context.params).id, user.id, {
      ...input,
      scope: input.scope as StoryFactScope
    });
    return json({ fact }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:canon" });
    const factId = new URL(request.url).searchParams.get("factId");
    if (!factId) {
      throw new HttpError(400, "factId is required.");
    }
    const input = await parseJson(request, storyFactUpdateSchema);
    const fact = await updateStoryFact((await context.params).id, factId, user.id, {
      ...input,
      scope: input.scope as StoryFactScope | undefined,
      status: input.status as StoryFactStatus | undefined,
      knowledgeState: input.knowledgeState as StoryKnowledgeState | undefined
    });
    return json({ fact });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:canon" });
    const factId = new URL(request.url).searchParams.get("factId");
    if (!factId) {
      throw new HttpError(400, "factId is required.");
    }
    await updateStoryFact((await context.params).id, factId, user.id, { status: StoryFactStatus.RETRACTED });
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
