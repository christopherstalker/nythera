import "server-only";

import { prisma } from "@/lib/prisma";

export function getRecentChats(userId: string, take = 8, characterId?: string | null) {
  return prisma.chat.findMany({
    where: {
      userId,
      archivedAt: null,
      ...(characterId ? { characterId } : {})
    },
    orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
    take: Math.min(Math.max(take, 1), 60),
    select: {
      id: true,
      title: true,
      characterId: true,
      lastActiveAt: true,
      createdAt: true,
      updatedAt: true,
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
          content: true,
          role: true,
        }
      }
    }
  });
}
