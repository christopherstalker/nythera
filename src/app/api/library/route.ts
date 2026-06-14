import { json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [mine, liked, chats, remixes] = await Promise.all([
      prisma.character.findMany({
        where: { creatorId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
          creator: { select: { username: true, avatarUrl: true, image: true } }
        }
      }),
      prisma.characterLike.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          character: {
            include: {
              creator: { select: { username: true, avatarUrl: true, image: true } }
            }
          }
        }
      }),
      prisma.chat.findMany({
        where: { userId: user.id, archivedAt: null },
        orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
        take: 20,
        include: {
          character: { select: { id: true, name: true, avatarUrl: true } },
          messages: {
            orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
            take: 1,
            select: { content: true, role: true }
          }
        }
      }),
      prisma.character.findMany({
        where: {
          creatorId: user.id,
          cloneSourceId: { not: null }
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
          creator: { select: { username: true, avatarUrl: true, image: true } }
        }
      })
    ]);

    return json({
      mine,
      liked: liked.map((item) => item.character),
      chats,
      remixes
    });
  } catch (error) {
    return routeError(error);
  }
}
