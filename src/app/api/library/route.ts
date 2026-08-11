import { getRequestIp, json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const libraryCharacterSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  description: true
} as const;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "library:read" });
    const [mine, liked, chats] = await Promise.all([
      prisma.character.findMany({
        where: { creatorId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: libraryCharacterSelect
      }),
      prisma.characterLike.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          character: { select: libraryCharacterSelect }
        }
      }),
      prisma.chat.findMany({
        where: { userId: user.id, archivedAt: null },
        orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
        take: 20,
        include: {
          character: { select: { id: true, name: true, description: true, avatarUrl: true } },
          messages: {
            orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
            take: 1,
            select: { content: true, role: true }
          }
        }
      })
    ]);

    return json(
      { mine, liked: liked.map((item) => item.character), chats },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    return routeError(error);
  }
}
