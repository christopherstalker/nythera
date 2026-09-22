import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { requireAdultConsent } from "@/lib/adult-consent";
import { completeLocalGeneration } from "@/lib/local-generation-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { syncChatTurns } from "@/lib/stories/story-foundation";
import { schedulePostResponseTasks } from "@/lib/post-response";

const completionSchema = z.object({ generationId: z.string().cuid(), content: z.string().trim().min(1).max(100000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdultConsent(user);
    const { id } = await context.params;
    await enforceRateLimit({ userId: user.id, route: "chat:local-complete" });
    const input = await parseJson(request, completionSchema);
    const message = await completeLocalGeneration({ ...input, userId: user.id, chatId: id });
    schedulePostResponseTasks("Local story sync", [{ name: "story sync", run: () => syncChatTurns(id, user.id) }]);
    return json({ message }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
