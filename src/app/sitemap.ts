import type { MetadataRoute } from "next";
import { DISCOVERY_TAGS } from "@/lib/character-tags";
import { prisma } from "@/lib/prisma";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-origin";

export const revalidate = 3600;

const staticRoutes = [
  "",
  "/ai-roleplay",
  "/ai-character-chat",
  "/roleplay-characters",
  "/explore",
  "/guide",
  "/guide/platform",
  "/guide/api",
  "/guide/roleplay-formatting",
  "/support",
  "/download",
  "/privacy",
  "/terms"
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${CANONICAL_SITE_ORIGIN}${path}`,
    changeFrequency: path === "" || path === "/explore" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/explore" ? 0.9 : 0.7
  }));

  try {
    const characters = await prisma.character.findMany({
      where: {
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        blockedAt: null,
        isNSFW: false
      },
      select: {
        id: true,
        updatedAt: true,
        avatarUrl: true,
        tags: true,
        creator: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 45000
    });

    const publishedTags = new Set(characters.flatMap((character) => character.tags));
    const tagLastModified = new Map<string, Date>();
    const creatorLastModified = new Map<string, Date>();
    for (const character of characters) {
      for (const tag of character.tags) {
        if (!tagLastModified.has(tag)) tagLastModified.set(tag, character.updatedAt);
      }
      if (character.creator.username && !creatorLastModified.has(character.creator.username)) {
        creatorLastModified.set(character.creator.username, character.updatedAt);
      }
    }
    const tagEntries: MetadataRoute.Sitemap = DISCOVERY_TAGS
      .filter((tag) => publishedTags.has(tag.slug))
      .map((tag) => ({
        url: `${CANONICAL_SITE_ORIGIN}/tags/${tag.slug}`,
        lastModified: tagLastModified.get(tag.slug),
        changeFrequency: "weekly",
        priority: 0.65
      }));
    const characterEntries: MetadataRoute.Sitemap = characters.map((character) => ({
      url: `${CANONICAL_SITE_ORIGIN}/character/${character.id}`,
      lastModified: character.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
      images: character.avatarUrl ? [character.avatarUrl] : undefined
    }));
    const creatorEntries: MetadataRoute.Sitemap = Array.from(creatorLastModified, ([username, lastModified]) => ({
      url: `${CANONICAL_SITE_ORIGIN}/u/${encodeURIComponent(username)}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.55
    }));

    return [...staticEntries, ...tagEntries, ...creatorEntries, ...characterEntries];
  } catch {
    return staticEntries;
  }
}
