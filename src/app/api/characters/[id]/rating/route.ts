import { auth } from "@/lib/auth";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ratingSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
  try {
    const session = await auth();
    const character = await prisma.character.findUnique({
      where: { id: context.params.id },
      select: { id: true, ratingAverage: true, ratingCount: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
    }

    const [myRating, reviews] = await Promise.all([
      session?.user?.id
        ? prisma.characterRating.findUnique({
            where: {
              userId_characterId: {
                userId: session.user.id,
                characterId: character.id
              }
            }
          })
        : Promise.resolve(null),
      prisma.characterRating.findMany({
        where: {
          characterId: character.id,
          review: { not: null }
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: {
          user: {
            select: {
              username: true,
              image: true,
              avatarUrl: true
            }
          }
        }
      })
    ]);

    return json({ rating: { average: character.ratingAverage, count: character.ratingCount, mine: myRating }, reviews });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "characters:rating" });
    const input = await parseJson(request, ratingSchema);

    const result = await prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: context.params.id },
        select: { id: true, blockedAt: true }
      });

      if (!character || character.blockedAt) {
        throw new HttpError(404, "Character not found.");
      }

      await tx.characterRating.upsert({
        where: {
          userId_characterId: {
            userId: user.id,
            characterId: character.id
          }
        },
        update: {
          value: input.value,
          review: input.review?.trim() || null
        },
        create: {
          userId: user.id,
          characterId: character.id,
          value: input.value,
          review: input.review?.trim() || null
        }
      });

      const aggregate = await tx.characterRating.aggregate({
        where: { characterId: character.id },
        _avg: { value: true },
        _count: { value: true }
      });

      const updated = await tx.character.update({
        where: { id: character.id },
        data: {
          ratingAverage: aggregate._avg.value ?? 0,
          ratingCount: aggregate._count.value
        },
        select: {
          ratingAverage: true,
          ratingCount: true
        }
      });

      return updated;
    });

    return json({ rating: { average: result.ratingAverage, count: result.ratingCount } });
  } catch (error) {
    return routeError(error);
  }
}
