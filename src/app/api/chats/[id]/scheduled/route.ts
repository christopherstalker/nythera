import { MessageRole, StoryProactiveStatus } from "@prisma/client";
import { getRequestIp, json, requireUser, routeError } from "@/lib/api";
import { createMessageWithNextSequence } from "@/lib/message-sequence";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "chat:scheduled" });
    const { id } = await context.params;
    const chat = await prisma.chat.findFirst({ where: { id, userId: user.id, storyId: { not: null } }, select: { id: true, storyId: true } });
    if (!chat?.storyId) return json({ created: 0 });
    const due = await prisma.storyProactiveEvent.findMany({ where: { storyId: chat.storyId, status: { in: [StoryProactiveStatus.SCHEDULED, StoryProactiveStatus.READY] }, triggerAt: { not: null, lte: new Date() } }, orderBy: [{ priority: "desc" }, { triggerAt: "asc" }], take: 4 });
    let created = 0;
    for (const event of due) {
      const claimed = await prisma.storyProactiveEvent.updateMany({ where: { id: event.id, status: { in: [StoryProactiveStatus.SCHEDULED, StoryProactiveStatus.READY] } }, data: { status: StoryProactiveStatus.FIRED, firedAt: new Date() } });
      if (!claimed.count) continue;
      await createMessageWithNextSequence({ chatId: chat.id, role: MessageRole.ASSISTANT, content: event.instruction, model: "scheduled-event" });
      created += 1;
    }
    if (created) await prisma.chat.update({ where: { id: chat.id }, data: { messageCount: { increment: created }, lastActiveAt: new Date() } });
    return json({ created });
  } catch (error) { return routeError(error); }
}
