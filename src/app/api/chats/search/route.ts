import { json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { searchMemories } from "@/lib/vector";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    const characterId = params.get("characterId") || undefined;
    if (query.length < 2) return json({ matches: [] });

    const textMatches = await prisma.message.findMany({
      where: {
        content: { contains: query, mode: "insensitive" },
        chat: { userId: user.id, ...(characterId ? { characterId } : {}) }
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, content: true, createdAt: true, chat: { select: { id: true, title: true, character: { select: { name: true, avatarUrl: true } } } } }
    });

    let semanticChatIds: string[] = [];
    try {
      const memories = await searchMemories({ userId: user.id, characterId, query, limit: 10, providerKeys: await getEffectiveProviderKeys(user.id), includeGlobal: false });
      const sources = await prisma.memory.findMany({ where: { id: { in: memories.map((memory) => memory.id) }, sourceChatId: { not: null } }, select: { sourceChatId: true } });
      semanticChatIds = sources.flatMap((source) => source.sourceChatId ? [source.sourceChatId] : []);
    } catch {
      semanticChatIds = [];
    }

    const semanticMatches = semanticChatIds.length ? await prisma.message.findMany({
      where: { chatId: { in: semanticChatIds }, chat: { userId: user.id, ...(characterId ? { characterId } : {}) } },
      orderBy: { createdAt: "desc" },
      distinct: ["chatId"],
      take: 8,
      select: { id: true, content: true, createdAt: true, chat: { select: { id: true, title: true, character: { select: { name: true, avatarUrl: true } } } } }
    }) : [];

    const seen = new Set<string>();
    const matches = [...textMatches, ...semanticMatches].filter((match) => !seen.has(match.id) && seen.add(match.id)).slice(0, 16);
    return json({ matches });
  } catch (error) {
    return routeError(error);
  }
}
