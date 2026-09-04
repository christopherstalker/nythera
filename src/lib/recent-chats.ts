import "server-only";

import { prisma } from "@/lib/prisma";
import { renderInitialChatGreeting } from "@/lib/character-prompt-contract";

export async function getRecentChats(userId: string, take = 8, characterId?: string | null) {
  const chats = await prisma.chat.findMany({
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
      persona: { select: { displayName: true, surname: true } },
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
          sequence: true
        }
      }
    }
  });

  const defaultPersona = chats.some((chat) => !chat.persona)
    ? await prisma.userPersona.findFirst({
        where: { userId, isDefault: true },
        select: { displayName: true, surname: true }
      })
    : null;

  return chats.map((chat) => {
    const persona = chat.persona ?? defaultPersona;
    const messages = chat.messages.map((message) => renderInitialChatGreeting(
      message,
      chat.character.name,
      persona
    ));
    const { persona: _persona, ...serializedChat } = chat;
    return { ...serializedChat, messages };
  });
}
