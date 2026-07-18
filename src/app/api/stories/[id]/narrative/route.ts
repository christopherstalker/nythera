import {
  StoryArcStatus,
  StoryBeatStatus,
  StoryHookStatus,
  StoryInitiative,
  StoryPacing,
  StoryProactiveStatus,
  StoryTurnChannel
} from "@prisma/client";
import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createStoryArc,
  createStoryBeat,
  createStoryHook,
  createStoryProactiveEvent,
  getStoryNarrative,
  updateStoryDirector,
  updateStoryNarrativeItem,
  upsertStoryRelationship
} from "@/lib/stories/narrative-store";
import { storyDirectorSchema, storyNarrativeCreateSchema, storyNarrativeUpdateSchema } from "@/lib/validation";

type Context = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const timelineId = new URL(request.url).searchParams.get("timelineId");
    return json(await getStoryNarrative(context.params.id, user.id, timelineId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:narrative" });
    const input = await parseJson(request, storyDirectorSchema);
    const director = await updateStoryDirector(context.params.id, user.id, {
      ...input,
      pacing: input.pacing as StoryPacing,
      initiative: input.initiative as StoryInitiative
    });
    return json({ director });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:narrative" });
    const input = await parseJson(request, storyNarrativeCreateSchema);

    if (input.kind === "arc") {
      return json({ item: await createStoryArc(context.params.id, user.id, input) }, { status: 201 });
    }
    if (input.kind === "beat") {
      return json({ item: await createStoryBeat(context.params.id, user.id, { ...input, status: input.status as StoryBeatStatus }) }, { status: 201 });
    }
    if (input.kind === "hook") {
      return json({ item: await createStoryHook(context.params.id, user.id, input) }, { status: 201 });
    }
    if (input.kind === "relationship") {
      return json({ item: await upsertStoryRelationship(context.params.id, user.id, input) }, { status: 201 });
    }
    return json({
      item: await createStoryProactiveEvent(context.params.id, user.id, {
        ...input,
        channel: input.channel as StoryTurnChannel
      })
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:narrative" });
    const input = await parseJson(request, storyNarrativeUpdateSchema);
    const item = await updateStoryNarrativeItem(context.params.id, user.id, {
      ...input,
      arcStatus: input.arcStatus as StoryArcStatus | undefined,
      beatStatus: input.beatStatus as StoryBeatStatus | undefined,
      hookStatus: input.hookStatus as StoryHookStatus | undefined,
      eventStatus: input.eventStatus as StoryProactiveStatus | undefined
    });
    return json({ item });
  } catch (error) {
    return routeError(error);
  }
}
