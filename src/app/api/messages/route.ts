import { prisma } from "@/lib/prisma";
import { HttpError, json, requireUser, routeError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const cursor = searchParams.get("cursor");
    const take = Math.min(Number(searchParams.get("take") ?? 50), 100);

    if (!chatId) {
      throw new HttpError(400, "chatId is required.");
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true }
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    return json({ messages: messages.reverse() });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("id");

    if (!messageId) {
      throw new HttpError(400, "id is required.");
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          select: { userId: true }
        }
      }
    });

    if (!message || message.chat.userId !== user.id) {
      throw new HttpError(404, "Message not found.");
    }

    await prisma.message.delete({ where: { id: messageId } });
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
