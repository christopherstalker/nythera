import { prisma } from "@/lib/prisma";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { z } from "zod";

const messageUpdateSchema = z.object({
  content: z.string().trim().min(1).max(4000)
});

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
      orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
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

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("id");
    if (!messageId) {
      throw new HttpError(400, "id is required.");
    }

    const input = await parseJson(request, messageUpdateSchema);
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          select: { userId: true, id: true }
        }
      }
    });

    if (!message || message.chat.userId !== user.id) {
      throw new HttpError(404, "Message not found.");
    }

    if (message.role !== "USER") {
      throw new HttpError(400, "Only user messages can be edited.");
    }

    const ordered = await prisma.message.findMany({
      where: { chatId: message.chat.id },
      orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }],
      select: { id: true }
    });
    const messageIndex = ordered.findIndex((item) => item.id === message.id);
    if (messageIndex < 0) {
      throw new HttpError(409, "Message order changed. Refresh and try again.");
    }
    const deletedMessageIds = ordered.slice(messageIndex + 1).map((item) => item.id);

    const updated = await prisma.$transaction(async (tx) => {
      const nextMessage = await tx.message.update({
        where: { id: message.id },
        data: { content: input.content }
      });
      if (deletedMessageIds.length > 0) {
        await tx.message.deleteMany({ where: { id: { in: deletedMessageIds } } });
      }
      await tx.chat.update({
        where: { id: message.chat.id },
        data: { messageCount: messageIndex + 1, updatedAt: new Date(), lastActiveAt: new Date() }
      });
      return nextMessage;
    });

    return json({ message: updated, deletedMessageIds });
  } catch (error) {
    return routeError(error);
  }
}
