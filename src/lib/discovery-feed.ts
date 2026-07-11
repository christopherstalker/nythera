import "server-only";

import { Prisma, Visibility } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { DISCOVERY_TAGS, expandTagQuery } from "@/lib/character-tags";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";
import { measurePrismaOperation } from "@/lib/performance-logger";
import { prisma } from "@/lib/prisma";

export const DISCOVERY_FEED_REVALIDATE_SECONDS = 60;
export const DISCOVERY_FEED_STALE_SECONDS = 300;

type PublicCharacterSort = "trending" | "top-rated" | "new";
type PublicCharacterNsfwMode = "safe" | "include" | "only";

export type PublicCharacterQuery = {
  search: string | null;
  tags: string[];
  sort: PublicCharacterSort;
  nsfw: PublicCharacterNsfwMode;
  minRating: number;
  take: number;
};

const publicCharacterInclude = {
  creator: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      image: true
    }
  }
} satisfies Prisma.CharacterInclude;

export function normalizePublicCharacterQuery(input: {
  search?: string | null;
  tags?: string[];
  sort?: string | null;
  nsfw?: string | null;
  minRating?: number;
  take?: number;
}): PublicCharacterQuery {
  const take = Number.isFinite(input.take)
    ? Math.min(Math.max(Math.trunc(input.take ?? 24), 1), 50)
    : 24;
  const minRating = Number.isFinite(input.minRating)
    ? Math.min(Math.max(input.minRating ?? 0, 0), 5)
    : 0;

  return {
    search: input.search?.trim() || null,
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].sort(),
    sort: normalizeSort(input.sort),
    nsfw: normalizeNsfwMode(input.nsfw),
    minRating,
    take
  };
}

export function shouldCachePublicCharacterQuery(query: PublicCharacterQuery) {
  return !query.search && query.tags.length === 0 && query.minRating === 0;
}

export function discoveryFeedCacheHeaders(): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${DISCOVERY_FEED_REVALIDATE_SECONDS}, stale-while-revalidate=${DISCOVERY_FEED_STALE_SECONDS}`
  };
}

export async function getPublicCharacters(query: PublicCharacterQuery) {
  if (!shouldCachePublicCharacterQuery(query)) {
    return readPublicCharacters(query);
  }

  return readCachedPublicCharacters(publicCharacterQueryCacheKey(query), query);
}

const readCachedPublicCharacters = unstable_cache(
  async (_cacheKey: string, query: PublicCharacterQuery) => readPublicCharacters(query),
  ["public-character-feed-v1"],
  {
    revalidate: DISCOVERY_FEED_REVALIDATE_SECONDS,
    tags: ["public-character-feed"]
  }
);

async function readPublicCharacters(query: PublicCharacterQuery) {
  const characters = await measurePrismaOperation(
    {
      route: "characters:get",
      operation: "discovery_feed",
      cacheable: shouldCachePublicCharacterQuery(query),
      sort: query.sort,
      take: query.take
    },
    () =>
      prisma.character.findMany({
        where: publicCharacterWhere(query),
        orderBy: publicCharacterOrderBy(query.sort),
        take: query.take,
        include: publicCharacterInclude
      }),
    (result) => ({ itemCount: result.length })
  );

  return characters.map(redactCharacterModelSettings);
}

function publicCharacterWhere(query: PublicCharacterQuery): Prisma.CharacterWhereInput {
  const where: Prisma.CharacterWhereInput = {
    visibility: Visibility.PUBLIC,
    moderationStatus: "APPROVED",
    blockedAt: null,
    AND: [
      { name: { not: "" } },
      { description: { not: "" } },
      { greeting: { not: "" } },
      { personality: { not: "" } },
      { scenario: { not: null } },
      { scenario: { not: "" } },
      { persona: { not: Prisma.JsonNull } }
    ]
  };

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

  if (query.nsfw === "only") {
    where.isNSFW = true;
  } else if (query.nsfw !== "include") {
    where.isNSFW = false;
  }

  if (query.minRating > 0) {
    where.ratingAverage = { gte: query.minRating };
  }

  return where;
}

function publicCharacterOrderBy(sort: PublicCharacterSort): Prisma.CharacterOrderByWithRelationInput[] {
  if (sort === "new") {
    return [{ createdAt: "desc" }];
  }

  if (sort === "top-rated") {
    return [{ ratingAverage: "desc" }, { ratingCount: "desc" }, { likes: "desc" }];
  }

  return [{ likes: "desc" }, { ratingAverage: "desc" }, { createdAt: "desc" }];
}

function publicCharacterQueryCacheKey(query: PublicCharacterQuery) {
  return [
    query.sort,
    query.nsfw,
    query.take
  ].join(":");
}

function normalizeSort(value?: string | null): PublicCharacterSort {
  return value === "new" || value === "top-rated" || value === "trending" ? value : "trending";
}

function normalizeNsfwMode(value?: string | null): PublicCharacterNsfwMode {
  return value === "include" || value === "only" || value === "safe" ? value : "safe";
}

export { DISCOVERY_TAGS };
