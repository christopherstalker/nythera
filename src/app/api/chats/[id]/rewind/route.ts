import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { rewindChat } from "@/lib/chat-rewind";

type Context = {
  params: Promise<{ id: string }>;
};

const rewindSchema = z.object({
  messageId: z.string().trim().min(1).max(120)
});

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, rewindSchema);
    const result = await rewindChat({
      chatId: (await context.params).id,
      userId: user.id,
      messageId: input.messageId
    });
    return json(result);
  } catch (error) {
    return routeError(error);
  }
}
