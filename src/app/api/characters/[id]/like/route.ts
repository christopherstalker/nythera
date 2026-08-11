import { prisma } from "@/lib/prisma";
import { HttpError, json, requireUser, routeError } from "@/lib/api";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const character = await prisma.character.findUnique({
      where: { id: (await context.params).id },
      select: { id: true, visibility: true, moderationStatus: true, blockedAt: true }
    });

    if (!character || character.visibility !== "PUBLIC" || character.moderationStatus !== "APPROVED" || character.blockedAt) {
      throw new HttpError(404, "Character not found.");
    }

    const existing = await prisma.characterLike.findUnique({
      where: {
        userId_characterId: {
          userId: user.id,
          characterId: character.id
        }
      }
    });

    if (existing) {
      await prisma.$transaction([
        prisma.characterLike.delete({
          where: {
            userId_characterId: {
              userId: user.id,
              characterId: character.id
            }
          }
        }),
        prisma.character.update({
          where: { id: character.id },
          data: { likes: { decrement: 1 } }
        })
      ]);

      return json({ liked: false });
    }

    await prisma.$transaction([
      prisma.characterLike.create({
        data: {
          userId: user.id,
          characterId: character.id
        }
      }),
      prisma.character.update({
        where: { id: character.id },
        data: { likes: { increment: 1 } }
      })
    ]);

    return json({ liked: true });
  } catch (error) {
    return routeError(error);
  }
}
