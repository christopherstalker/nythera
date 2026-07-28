import "server-only";

import { prisma } from "@/lib/prisma";

export function getRecentChats(userId: string, take = 8) {
  return prisma.chat.findMany({
    where: {
      userId,
      archivedAt: null
    },
    orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
    take: Math.min(Math.max(take, 1), 20),
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
}
