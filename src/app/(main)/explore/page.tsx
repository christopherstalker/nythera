"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CharacterGrid } from "@/components/characters/CharacterGrid";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { CategoryPill } from "@/components/ui/category-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";

const categories = ["For You", "Trending", "Top Rated", "New", "Romance", "Fantasy", "Anime", "Coach", "Friend", "Roleplay", "Lore"];

export default function ExplorePage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("For You");
  const [loading, setLoading] = useState(true);
  const hasActiveFilters = query.trim().length > 0 || activeCategory !== "For You";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ take: "50" });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (activeCategory === "Trending") {
      params.set("sort", "trending");
    } else if (activeCategory === "Top Rated") {
      params.set("sort", "top-rated");
    } else if (activeCategory === "New") {
      params.set("sort", "new");
    } else if (activeCategory !== "For You") {
      params.set("tag", activeCategory.toLowerCase());
    }

    fetch(`/api/characters?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setCharacters(Array.isArray(body.characters) ? body.characters : []))
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [activeCategory, query]);

  return (
    <PageShell className="space-y-6">
      <Surface className="relative isolate overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-60" />
        <PageHeader
          title="Explore"
          description="Find user-created personas by mood, role, genre, or conversation hook."
          actions={
            <Button asChild variant="secondary">
              <Link href="/create-character">
                <Plus className="h-4 w-4" />
                Create
              </Link>
            </Button>
          }
        />
        <SearchBar className="mt-5" value={query} onChange={setQuery} placeholder="Search characters..." showFilterIcon />
      </Surface>

      <div className="scrollbar-none overflow-x-auto">
        <div className="flex w-max gap-2 pb-1">
          {categories.map((category) => (
            <CategoryPill key={category} label={category} active={category === activeCategory} onClick={() => setActiveCategory(category)} />
          ))}
        </div>
      </div>

      {loading || characters.length > 0 ? (
        <CharacterGrid characters={characters} loading={loading} />
      ) : (
        <EmptyState
          icon={Search}
          title={hasActiveFilters ? "No characters found" : "No characters yet"}
          description={
            hasActiveFilters
              ? "Try another character name, mood, or category."
              : "The public catalog is empty right now. Create a character to start building Velora."
          }
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
      )}
    </PageShell>
  );
}
