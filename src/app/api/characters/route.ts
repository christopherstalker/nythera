import { Prisma, Visibility } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { characterCreateSchema } from "@/lib/validation";
import { expandTagQuery } from "@/lib/character-tags";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";
import { createCharacterForUser } from "@/lib/character-mutations";
import {
  DISCOVERY_TAGS,
  discoveryFeedCacheHeaders,
  getPublicCharacters,
  normalizePublicCharacterQuery,
  shouldCachePublicCharacterQuery
} from "@/lib/discovery-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "characters:read"
    });
    const { searchParams } = new URL(request.url);
    if ((searchParams.get("q")?.length ?? 0) > 120 || searchParams.getAll("tag").length > 10) {
      throw new HttpError(400, "Search query is too large.");
    }
    const mine = searchParams.get("mine") === "true";
    const rawTags = [
      ...searchParams.getAll("tag"),
      ...(searchParams.get("tags")?.split(",") ?? [])
    ].map((tag) => tag.trim()).filter(Boolean);
    const visibility = normalizeVisibility(searchParams.get("visibility"));
    const query = normalizePublicCharacterQuery({
      search: searchParams.get("q"),
      tags: rawTags,
      sort: searchParams.get("sort"),
      nsfw: searchParams.get("nsfw"),
      minRating: Number(searchParams.get("ratingMin") ?? 0),
      take: Number(searchParams.get("take") ?? 24)
    });

    if (!mine) {
      const characters = await getPublicCharacters(query);
      return json(
        { characters, tags: DISCOVERY_TAGS },
        shouldCachePublicCharacterQuery(query) ? { headers: discoveryFeedCacheHeaders() } : undefined
      );
    }

    const session = await auth();

    const where: Prisma.CharacterWhereInput = { creatorId: session?.user?.id ?? "__none__" };

    if (visibility && mine) {
      where.visibility = visibility;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { personality: { contains: query.search, mode: "insensitive" } },
        { tags: { hasSome: expandTagQuery(query.search) } }
      ];
    }

    if (query.tags.length > 0) {
      where.tags = { hasSome: query.tags.flatMap(expandTagQuery) };
    }

    if (query.minRating > 0) {
      where.ratingAverage = { gte: query.minRating };
    }

    const orderBy =
      query.sort === "new"
        ? [{ createdAt: "desc" as const }]
        : query.sort === "top-rated"
          ? [{ ratingAverage: "desc" as const }, { ratingCount: "desc" as const }, { likes: "desc" as const }]
          : [{ likes: "desc" as const }, { ratingAverage: "desc" as const }, { createdAt: "desc" as const }];

    const characters = await prisma.character.findMany({
      where,
      orderBy,
      take: query.take,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            image: true
          }
        }
      }
    });

    return json({ characters: characters.map(redactCharacterModelSettings), tags: DISCOVERY_TAGS });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:create"
    });

    const input = await parseJson(request, characterCreateSchema);
    const character = await createCharacterForUser(input, user);

    return json({ character }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

function normalizeVisibility(value: string | null): Visibility | null {
  if (value === Visibility.PRIVATE) return Visibility.PRIVATE;
  if (value === Visibility.PUBLIC) return Visibility.PUBLIC;
  if (value === Visibility.UNLISTED) return Visibility.UNLISTED;
  return null;
}
