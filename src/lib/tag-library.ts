import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  type CharacterTagOption,
  SYSTEM_TAG_OPTIONS,
  displayTagLabel,
  mergeCharacterTagOptions,
  normalizeCharacterTags
} from "@/lib/character-tags";
import { prisma } from "@/lib/prisma";

const USER_TAG_LIMIT = 60;
const PUBLIC_TAG_LIMIT = 60;

type PopularTagRow = {
  slug: string;
  usageCount: number;
};

export async function rememberUserTags(
  transaction: Prisma.TransactionClient,
  userId: string,
  values: string[]
) {
  const tags = normalizeCharacterTags(values);
  const lastUsedAt = new Date();

  await Promise.all(tags.map((slug) => transaction.userTag.upsert({
    where: { userId_slug: { userId, slug } },
    create: {
      userId,
      slug,
      label: displayTagLabel(slug),
      lastUsedAt
    },
    update: {
      label: displayTagLabel(slug),
      useCount: { increment: 1 },
      lastUsedAt
    }
  })));
}

export async function getUserTagOptions(userId: string) {
  const [savedTags, publicTags] = await Promise.all([
    prisma.userTag.findMany({
      where: { userId },
      orderBy: [{ lastUsedAt: "desc" }, { useCount: "desc" }, { label: "asc" }],
      take: USER_TAG_LIMIT,
      select: { slug: true, label: true, useCount: true }
    }),
    getPublicTagOptions()
  ]);

  const savedOptions: CharacterTagOption[] = savedTags.map((tag) => ({
    slug: tag.slug,
    label: tag.label,
    source: "saved",
    usageCount: tag.useCount
  }));

  return mergeCharacterTagOptions(savedOptions, SYSTEM_TAG_OPTIONS, publicTags);
}

export const getPublicTagOptions = unstable_cache(
  async () => {
    const rows = await prisma.$queryRaw<PopularTagRow[]>(Prisma.sql`
      SELECT
        tag.value AS "slug",
        COUNT(*)::INTEGER AS "usageCount"
      FROM "Character" AS character
      CROSS JOIN LATERAL unnest(character."tags") AS tag(value)
      WHERE character."visibility" = 'PUBLIC'
        AND character."moderationStatus" = 'APPROVED'
        AND character."blockedAt" IS NULL
      GROUP BY tag.value
      ORDER BY COUNT(*) DESC, tag.value ASC
      LIMIT ${PUBLIC_TAG_LIMIT}
    `);
    const popularOptions: CharacterTagOption[] = rows.map((tag) => ({
      slug: tag.slug,
      label: displayTagLabel(tag.slug),
      source: "popular",
      usageCount: tag.usageCount
    }));

    return mergeCharacterTagOptions(SYSTEM_TAG_OPTIONS, popularOptions);
  },
  ["public-character-tags-v1"],
  { revalidate: 60 * 60, tags: ["public-character-feed"] }
);
