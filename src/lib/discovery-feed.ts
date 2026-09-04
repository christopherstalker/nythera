import "server-only";

import { Prisma, Visibility } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { DISCOVERY_TAGS, expandTagQuery } from "@/lib/character-tags";
import {
  type DiscoveryNsfwMode,
  type DiscoverySort,
  type DiscoveryTagMatch,
  normalizeDiscoveryFilters
} from "@/lib/discovery-query";
import { measurePrismaOperation } from "@/lib/performance-logger";
import { prisma } from "@/lib/prisma";

export const DISCOVERY_FEED_REVALIDATE_SECONDS = 60 * 60;
export const DISCOVERY_FEED_STALE_SECONDS = 24 * 60 * 60;

export type PublicCharacterQuery = {
  search: string | null;
  tags: string[];
  sort: DiscoverySort;
  nsfw: DiscoveryNsfwMode;
  tagMatch: DiscoveryTagMatch;
  minRating: number;
  take: number;
};

const publicCharacterSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  description: true,
  discoveryPlacement: true,
  tags: true,
  likes: true,
  ratingAverage: true,
  ratingCount: true,
  isNSFW: true,
  originType: true,
  isRealPerson: true,
  aiDisclosure: true,
  creator: {
    select: {
      username: true
    }
  }
} satisfies Prisma.CharacterSelect;

export function normalizePublicCharacterQuery(input: {
  search?: string | null;
  tags?: string[];
  sort?: string | null;
  nsfw?: string | null;
  minRating?: number;
  take?: number;
  tagMatch?: string | null;
}): PublicCharacterQuery {
  const take = Number.isFinite(input.take)
    ? Math.min(Math.max(Math.trunc(input.take ?? 24), 1), 50)
    : 24;
  const filters = normalizeDiscoveryFilters({
    query: input.search,
    tags: input.tags,
    sort: input.sort,
    nsfw: input.nsfw,
    ratingMin: input.minRating,
    tagMatch: input.tagMatch
  });

  return {
    search: filters.query || null,
    tags: filters.tags,
    sort: filters.sort,
    nsfw: filters.nsfw,
    tagMatch: filters.tagMatch,
    minRating: filters.ratingMin,
    take
  };
}

export function shouldCachePublicCharacterQuery(query: PublicCharacterQuery) {
  return !query.search;
}

export function discoveryFeedCacheHeaders(query?: PublicCharacterQuery): HeadersInit {
  const revalidate = query?.search ? 60 : DISCOVERY_FEED_REVALIDATE_SECONDS;
  const stale = query?.search ? 5 * 60 : DISCOVERY_FEED_STALE_SECONDS;
  return {
    "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${stale}`
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
  ["public-character-feed-v2"],
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
        select: publicCharacterSelect
      }),
    (result) => ({ itemCount: result.length })
  );

  return characters;
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
    if (query.tagMatch === "all") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...query.tags.map((tag) => ({ tags: { hasSome: expandTagQuery(tag) } }))
      ];
    } else {
      where.tags = { hasSome: query.tags.flatMap(expandTagQuery) };
    }
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

function publicCharacterOrderBy(sort: DiscoverySort): Prisma.CharacterOrderByWithRelationInput[] {
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
    query.tagMatch,
    query.tags.join(","),
    query.minRating,
    query.take
  ].join(":");
}

export { DISCOVERY_TAGS };
