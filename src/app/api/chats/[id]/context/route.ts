import { HttpError, json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdultConsent } from "@/lib/adult-consent";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdultConsent(user);
    const { id } = await context.params;
    const messageId = new URL(request.url).searchParams.get("messageId");
    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id, archivedAt: null },
      select: { id: true }
    });
    if (!chat) throw new HttpError(404, "Chat not found.");
    const message = await prisma.message.findFirst({
      where: { chatId: id, role: "ASSISTANT", ...(messageId ? { id: messageId } : {}) },
      orderBy: { sequence: "desc" },
      select: { id: true, contextTrace: { select: { snapshot: true } } }
    });
    return json(
      { messageId: message?.id ?? null, trace: message?.contextTrace?.snapshot ?? null },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return routeError(error);
  }
}
