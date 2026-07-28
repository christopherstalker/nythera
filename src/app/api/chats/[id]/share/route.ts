import { Prisma } from "@prisma/client";
import { getRequestIp, HttpError, json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createStoryPackage } from "@/lib/stories/story-portability";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "shares:create" });
    const chat = await prisma.chat.findFirst({
      where: {
        id: context.params.id,
        userId: user.id
      },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            description: true,
            creator: {
              select: {
                username: true
              }
            }
          }
        },
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }],
          take: 80,
          select: {
            role: true,
            content: true,
            createdAt: true
          }
        }
      }
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const storySnapshot = chat.storyId ? await createStoryPackage(chat.storyId, user.id, true) : null;
    const snapshot = {
      title: chat.character.name,
      characterSnapshot: chat.character,
      messagesSnapshot: chat.messages,
      storySnapshot: storySnapshot ? JSON.parse(JSON.stringify(storySnapshot)) as Prisma.InputJsonValue : undefined
    };
    if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 512 * 1024) {
      throw new HttpError(413, "This chat is too large to share.");
    }
    const existing = await prisma.chatShare.findFirst({
      where: { chatId: chat.id, userId: user.id, expiresAt: null },
      orderBy: { createdAt: "desc" }
    });
    const share = existing ?? await prisma.chatShare.create({
      data: {
        chatId: chat.id,
        userId: user.id,
        ...snapshot
      }
    });

    return json({ share, url: `/share/${share.id}` }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
