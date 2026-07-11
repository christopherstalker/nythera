import { MessageRole } from "@prisma/client";
import { z } from "zod";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

const branchSchema = z.object({
  messageId: z.string().min(1),
  title: z.string().max(120).optional()
});

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chats:branch"
    });

    const input = await parseJson(request, branchSchema);
    const source = await prisma.chat.findFirst({
      where: {
        id: context.params.id,
        userId: user.id
      },
      include: {
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }]
        }
      }
    });

    if (!source) {
      throw new HttpError(404, "Chat not found.");
    }

    const targetIndex = source.messages.findIndex((message) => message.id === input.messageId);
    if (targetIndex < 0) {
      throw new HttpError(404, "Message not found.");
    }

    const messages = source.messages.slice(0, targetIndex + 1).filter((message) => message.role !== MessageRole.SYSTEM);

    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.chat.create({
        data: {
          userId: user.id,
          characterId: source.characterId,
          title: input.title || `${source.title || "Chat"} branch`,
          temperature: source.temperature,
          model: source.model,
          summary: source.summary,
          messageCount: messages.length
        }
      });

      if (messages.length) {
        await tx.message.createMany({
          data: messages.map((message, index) => ({
            chatId: created.id,
            sequence: index + 1,
            role: message.role,
            content: message.content,
            tokens: message.tokens,
            model: message.model,
            flagged: message.flagged
          }))
        });
      }

      return created;
    });

    return json({ chat: branch }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
