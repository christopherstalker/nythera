import { MessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { chatCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser();
    const chats = await prisma.chat.findMany({
      where: {
        userId: user.id,
        archivedAt: null
      },
      orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
      include: {
        character: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true
          }
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            content: true,
            role: true,
            createdAt: true
          }
        }
      }
    });

    return json({ chats });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chats:create"
    });

    const input = await parseJson(request, chatCreateSchema);
    const character = await prisma.character.findUnique({
      where: { id: input.characterId }
    });

    if (!character || character.blockedAt) {
      throw new HttpError(404, "Character not found.");
    }

    const canAccess =
      ((character.visibility === "PUBLIC" || character.visibility === "UNLISTED") &&
        character.moderationStatus === "APPROVED") ||
      character.creatorId === user.id ||
      user.role === "ADMIN";

    if (!canAccess) {
      throw new HttpError(404, "Character not found.");
    }

    const model = input.model ?? user.preferredModel;
    const chat = await prisma.$transaction(async (tx) => {
      const created = await tx.chat.create({
        data: {
          userId: user.id,
          characterId: character.id,
          title: input.title ?? null,
          temperature: input.temperature,
          model,
          messageCount: 1
        }
      });

      await tx.message.create({
        data: {
          chatId: created.id,
          sequence: 1,
          role: MessageRole.ASSISTANT,
          content: character.greeting,
          model
        }
      });

      return created;
    });

    return json({ chat }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
