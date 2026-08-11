import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getRecentChats } from "@/lib/recent-chats";
import { toChatPreview } from "@/lib/chat-preview";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [pinned, recentChats] = await Promise.all([
      prisma.chatSidebarPin.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          character: { select: { id: true, name: true, avatarUrl: true, description: true } }
        }
      }),
      getRecentChats(user.id, 5)
    ]);

    const favorites = pinned.map((item) => {
      const latestChat = recentChats.find((chat) => chat.character.id === item.character.id);
      return {
      characterId: item.character.id,
      name: item.character.name,
      avatarUrl: item.character.avatarUrl,
      preview: latestChat ? toChatPreview(latestChat.messages.at(-1)?.content || item.character.description || "") : item.character.description ?? "",
      chatId: latestChat?.id ?? null,
      lastActiveAt: (latestChat?.lastActiveAt ?? item.createdAt).toISOString(),
      presence: presenceFromDate(latestChat?.lastActiveAt ?? item.createdAt)
    };
    });

    const recent = recentChats.map((chat) => ({
      characterId: chat.character.id,
      name: chat.character.name,
      avatarUrl: chat.character.avatarUrl,
      preview: toChatPreview(chat.messages.at(-1)?.content || chat.character.description || ""),
      chatId: chat.id,
      lastActiveAt: chat.lastActiveAt.toISOString(),
      presence: presenceFromDate(chat.lastActiveAt)
    }));

    return json({ favorites, recent });
  } catch (error) {
    return routeError(error);
  }
}

function presenceFromDate(date: Date) {
  const minutes = (Date.now() - date.getTime()) / 60_000;
  if (minutes <= 15) return "online";
  if (minutes <= 24 * 60) return "away";
  return "offline";
}

const pinSchema = z.object({
  characterId: z.string().min(1),
  pinned: z.boolean()
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, pinSchema);
    const character = await prisma.character.findFirst({
      where: {
        id: input.characterId,
        blockedAt: null,
        OR: [
          { creatorId: user.id },
          { visibility: "PUBLIC", moderationStatus: "APPROVED" },
          { visibility: "UNLISTED", moderationStatus: "APPROVED" }
        ]
      },
      select: { id: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
    }

    if (input.pinned) {
      await prisma.chatSidebarPin.upsert({
        where: { userId_characterId: { userId: user.id, characterId: character.id } },
        update: { createdAt: new Date() },
        create: { userId: user.id, characterId: character.id }
      });
    } else {
      await prisma.chatSidebarPin.deleteMany({
        where: { userId: user.id, characterId: character.id }
      });
    }

    return json({ pinned: input.pinned });
  } catch (error) {
    return routeError(error);
  }
}
