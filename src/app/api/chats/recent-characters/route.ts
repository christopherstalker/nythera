import { prisma } from "@/lib/prisma";
import { json, requireUser, routeError } from "@/lib/api";
import { requireAdultConsent } from "@/lib/adult-consent";

export async function GET() {
  try {
    const user = await requireUser();
    requireAdultConsent(user);
    const chats = await prisma.chat.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      distinct: ["characterId"],
      take: 12,
      select: {
        id: true,
        title: true,
        character: { select: { id: true, name: true, avatarUrl: true } }
      }
    });
    return json({ chats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
