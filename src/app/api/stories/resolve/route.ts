import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { getStoryCodex } from "@/lib/stories/canon-store";
import { ensureStoryForChat, ensureStoryForRoom } from "@/lib/stories/story-foundation";

export const dynamic = "force-dynamic";

const resolveStorySchema = z
  .object({
    chatId: z.string().trim().min(1).optional(),
    roomId: z.string().trim().min(1).optional()
  })
  .refine((input) => Boolean(input.chatId) !== Boolean(input.roomId), {
    message: "Provide exactly one story surface."
  });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, resolveStorySchema);
    const foundation = input.chatId
      ? await ensureStoryForChat(input.chatId, user.id)
      : await ensureStoryForRoom(input.roomId!, user.id);
    const codex = await getStoryCodex(foundation.storyId, user.id, foundation.timelineId);
    return json({ foundation, ...codex });
  } catch (error) {
    return routeError(error);
  }
}
