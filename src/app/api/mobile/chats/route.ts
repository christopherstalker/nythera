import { MessageRole } from "@prisma/client";
import { json, parseJson, routeError, HttpError, getRequestIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { chatCreateSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
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
    const user = await requireMobileUser(request);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:chats:create"
    });

    const input = await parseJson(request, chatCreateSchema);
    const character = await prisma.character.findUnique({
      where: { id: input.characterId }
    });

    if (!character || character.blockedAt) {
      throw new HttpError(404, "Character not found.");
    }

    const canAccess =
      character.visibility === "PUBLIC" ||
      character.visibility === "UNLISTED" ||
      character.creatorId === user.id ||
      user.role === "ADMIN";

    if (!canAccess) {
      throw new HttpError(404, "Character not found.");
    }

    const chat = await prisma.$transaction(async (tx) => {
      const created = await tx.chat.create({
        data: {
          userId: user.id,
          characterId: character.id,
          title: input.title ?? null,
          temperature: input.temperature,
          model: input.model,
          messageCount: 1
        }
      });

      await tx.message.create({
        data: {
          chatId: created.id,
          sequence: 1,
          role: MessageRole.ASSISTANT,
          content: character.greeting,
          model: input.model
        }
      });

      return created;
    });

    const fullChat = await prisma.chat.findUnique({
      where: { id: chat.id },
      include: {
        character: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }]
        }
      }
    });

    return json({ chat: fullChat }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
