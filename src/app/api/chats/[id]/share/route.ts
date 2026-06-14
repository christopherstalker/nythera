import { HttpError, json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireUser();
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

    const share = await prisma.chatShare.create({
      data: {
        chatId: chat.id,
        userId: user.id,
        title: chat.title || chat.character.name,
        characterSnapshot: chat.character,
        messagesSnapshot: chat.messages
      }
    });

    return json({ share, url: `/share/${share.id}` }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
