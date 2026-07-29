import type { Metadata } from "next";
import ExplorePageClient from "@/components/explore/explore-page-client";
import { getPublicCharacters, normalizePublicCharacterQuery } from "@/lib/discovery-feed";

type ExplorePageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: ExplorePageProps): Promise<Metadata> {
  const query = normalizeSearchParam((await searchParams).q);

  return {
    title: query ? `Search results for “${query}”` : "Explore AI roleplay characters",
    description: "Discover public AI roleplay characters across fantasy, romance, adventure, sci-fi, mystery, and more in Nythera.",
    alternates: {
      canonical: "/explore"
    },
    robots: query
      ? {
          index: false,
          follow: true
        }
      : undefined
  };
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const query = normalizeSearchParam((await searchParams).q);
  const [characters, trending, recommended] = await Promise.all([
    getPublicCharacters(normalizePublicCharacterQuery({ search: query, take: 50, nsfw: "safe" })),
    getPublicCharacters(normalizePublicCharacterQuery({ take: 12, sort: "trending", nsfw: "safe" })),
    getPublicCharacters(normalizePublicCharacterQuery({ take: 12, sort: "new", nsfw: "safe" }))
  ]);

  return (
    <ExplorePageClient
      initialCharacters={characters}
      initialTrending={trending}
      initialRecommended={recommended}
      initialQuery={query}
    />
  );
}

function normalizeSearchParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 120) ?? "";
}
