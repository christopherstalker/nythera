import { StoryVisualKind } from "@prisma/client";
import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createStoryCheckpoint,
  createStoryVisualReference,
  getStoryContinuity,
  upsertStoryParticipantState,
  upsertStoryVoiceBinding
} from "@/lib/stories/continuity-store";
import { storyContinuityMutationSchema } from "@/lib/validation";

type Context = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const timelineId = new URL(request.url).searchParams.get("timelineId");
    return json(await getStoryContinuity(context.params.id, user.id, timelineId));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "stories:continuity" });
    const input = await parseJson(request, storyContinuityMutationSchema);
    if (input.kind === "participant_state") {
      return json({ item: await upsertStoryParticipantState(context.params.id, user.id, input) });
    }
    if (input.kind === "voice") {
      return json({ item: await upsertStoryVoiceBinding(context.params.id, user.id, input) });
    }
    if (input.kind === "visual") {
      return json({
        item: await createStoryVisualReference(context.params.id, user.id, {
          ...input,
          visualKind: input.visualKind as StoryVisualKind
        })
      }, { status: 201 });
    }
    return json({ item: await createStoryCheckpoint(context.params.id, user.id, input) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
