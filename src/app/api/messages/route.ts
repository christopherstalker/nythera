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

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { content: input.content }
    });

    await prisma.chat.update({
      where: { id: message.chat.id },
      data: { updatedAt: new Date(), lastActiveAt: new Date() }
    });

    return json({ message: updated });
  } catch (error) {
    return routeError(error);
  }
}
