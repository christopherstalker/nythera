"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { CharacterGrid } from "@/components/characters/CharacterGrid";
import { CharacterRow } from "@/components/characters/CharacterRow";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { CategoryPill } from "@/components/ui/category-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";

const categories = ["For You", "Trending", "New", "Romance", "Fantasy", "Sci-Fi", "Slice of Life", "Mentor", "Villain", "Roleplay"];

async function fetchCharacters(params: URLSearchParams, signal?: AbortSignal) {
  const response = await fetch(`/api/characters?${params.toString()}`, { signal });
  if (!response.ok) {
    return [];
  }
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.characters) ? body.characters : [];
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="skeleton h-40 rounded-[var(--radius-xl)]" />
        </PageShell>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [trending, setTrending] = useState<CharacterSummary[]>([]);
  const [recommended, setRecommended] = useState<CharacterSummary[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("For You");
  const [loading, setLoading] = useState(true);
  const hasActiveFilters = query.trim().length > 0 || activeCategory !== "For You";
  const showFeedSections = !hasActiveFilters;
  const isCatalogEmpty = !loading && characters.length === 0 && trending.length === 0 && recommended.length === 0;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ take: "50" });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (activeCategory === "Trending") {
      params.set("sort", "trending");
    } else if (activeCategory === "New") {
      params.set("sort", "new");
    } else if (activeCategory !== "For You") {
      params.set("tag", activeCategory.toLowerCase().replace(/\s+/g, "-"));
    }

    const tasks = [fetchCharacters(params, controller.signal).then(setCharacters)];

    if (showFeedSections) {
      tasks.push(
        fetchCharacters(new URLSearchParams({ take: "12", sort: "trending" }), controller.signal).then(setTrending),
        fetchCharacters(new URLSearchParams({ take: "12", sort: "new" }), controller.signal).then(setRecommended)
      );
    } else {
      setTrending([]);
      setRecommended([]);
    }

    Promise.all(tasks)
      .catch(() => {
        if (!controller.signal.aborted) {
          setCharacters([]);
          setTrending([]);
          setRecommended([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeCategory, query, showFeedSections]);

  useEffect(() => {
    const refresh = () => {
      const params = new URLSearchParams({ take: "50" });
      if (query.trim()) {
        params.set("q", query.trim());
      }
      void fetchCharacters(params).then(setCharacters);
      if (showFeedSections) {
        void fetchCharacters(new URLSearchParams({ take: "12", sort: "trending" })).then(setTrending);
        void fetchCharacters(new URLSearchParams({ take: "12", sort: "new" })).then(setRecommended);
      }
    };

    window.addEventListener("nythera:characters-updated", refresh);
    return () => window.removeEventListener("nythera:characters-updated", refresh);
  }, [query, showFeedSections]);

  function submitSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    setQuery(trimmed);
    router.replace(trimmed ? `/explore?q=${encodeURIComponent(trimmed)}` : "/explore");
  }

  return (
    <PageShell className="space-y-6">
      <Surface className="relative isolate overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-60" />
        <PageHeader
          title="Explore"
          description="Discover real user-created personas — no placeholders, only chat-ready characters."
          actions={
            <Button asChild variant="secondary">
              <Link href="/create-character">
                <Plus className="h-4 w-4" />
                Create
              </Link>
            </Button>
          }
        />
        <SearchBar
          className="mt-5"
          value={query}
          onChange={setQuery}
          onSubmit={submitSearch}
          placeholder="Search characters..."
          showFilterIcon
        />
      </Surface>

      <div className="scrollbar-none overflow-x-auto">
        <div className="flex w-max gap-2 pb-1">
          {categories.map((category) => (
            <CategoryPill key={category} label={category} active={category === activeCategory} onClick={() => setActiveCategory(category)} />
          ))}
        </div>
      </div>

      {showFeedSections ? (
        <div className="space-y-8">
          <CharacterRow title="Trending" characters={trending} loading={loading} />
          <CharacterRow title="Recommended" characters={recommended} loading={loading} />
          {characters.length > 0 ? <CharacterRow title="For You" characters={characters.slice(0, 12)} loading={loading} /> : null}
        </div>
      ) : null}

      {!showFeedSections && (loading || characters.length > 0) ? <CharacterGrid characters={characters} loading={loading} /> : null}

      {!loading && isCatalogEmpty ? (
        <EmptyState
          icon={Search}
          title={hasActiveFilters ? "No characters found" : "No public characters yet"}
          description={hasActiveFilters ? "Try another character name, mood, or category." : "The public catalog is empty right now. Create a character to start building Nythera."}
          action={
            hasActiveFilters ? null : (
              <Button asChild>
                <Link href="/create-character">
                  <Plus className="h-4 w-4" />
                  Create character
                </Link>
              </Button>
            )
          }
        />
      ) : null}
    </PageShell>
  );
}
