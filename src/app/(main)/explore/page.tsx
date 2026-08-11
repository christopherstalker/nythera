import type { Metadata } from "next";
import ExplorePageClient from "@/components/explore/explore-page-client";
import { ServiceUnavailable } from "@/components/system/service-unavailable";
import { PageShell } from "@/components/ui/page";
import { getPublicCharacters, normalizePublicCharacterQuery } from "@/lib/discovery-feed";
import { hasDiscoveryFilters, normalizeDiscoveryFilters } from "@/lib/discovery-query";
import { loadServerData } from "@/lib/server-data";

type ExplorePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ExplorePageProps): Promise<Metadata> {
  const filters = parseExploreFilters(await searchParams);

  return {
    title: filters.query ? `Search results for “${filters.query}”` : "Explore AI roleplay characters",
    description: "Discover public AI roleplay characters across fantasy, romance, adventure, sci-fi, mystery, and more in Nythera.",
    alternates: {
      canonical: "/explore"
    },
    robots: hasDiscoveryFilters(filters)
      ? {
          index: false,
          follow: true
        }
      : undefined
  };
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const filters = parseExploreFilters(await searchParams);
  let characters: Awaited<ReturnType<typeof getPublicCharacters>> = [];
  let trending: Awaited<ReturnType<typeof getPublicCharacters>> = [];
  let recommended: Awaited<ReturnType<typeof getPublicCharacters>> = [];
  let isServiceUnavailable = false;

  try {
    [characters, trending, recommended] = await loadServerData("Explore discovery feeds", () =>
      Promise.all([
        getPublicCharacters(normalizePublicCharacterQuery({
          search: filters.query,
          tags: filters.tags,
          sort: filters.sort,
          minRating: filters.ratingMin,
          nsfw: filters.nsfw,
          tagMatch: filters.tagMatch,
          take: 50
        })),
        getPublicCharacters(normalizePublicCharacterQuery({ take: 12, sort: "trending", nsfw: "safe" })),
        getPublicCharacters(normalizePublicCharacterQuery({ take: 12, sort: "new", nsfw: "safe" }))
      ])
    );
  } catch (error) {
    console.error("[explore] Discovery feeds unavailable", error);
    isServiceUnavailable = true;
  }

  if (isServiceUnavailable) {
    return (
      <PageShell>
        <ServiceUnavailable title="Character discovery is reconnecting" />
      </PageShell>
    );
  }

  return (
    <ExplorePageClient
      initialCharacters={characters}
      initialTrending={trending}
      initialRecommended={recommended}
      initialFilters={filters}
    />
  );
}

function parseExploreFilters(searchParams: Record<string, string | string[] | undefined>) {
  return normalizeDiscoveryFilters({
    query: first(searchParams.q),
    tags: all(searchParams.tag),
    sort: first(searchParams.sort),
    ratingMin: first(searchParams.ratingMin),
    nsfw: first(searchParams.nsfw),
    tagMatch: first(searchParams.match)
  });
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
