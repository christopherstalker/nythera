"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Plus, Search, Sparkles } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { Button } from "@/components/ui/button";
import { CategoryChips } from "@/components/ui/category-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";

type Character = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description: string;
  tags: string[];
  likes: number;
  ratingAverage?: number;
};

const categories = ["For You", "Trending", "Romance", "Fantasy", "Anime", "Coach", "Friend", "Roleplay"];

export default function ExplorePage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("For You");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/characters?take=36", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        setCharacters(Array.isArray(body.characters) ? body.characters : []);
      })
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    const category = activeCategory.toLowerCase();
    return characters.filter((character) => {
      const haystack = [character.name, character.description, ...character.tags].join(" ").toLowerCase();
      const matchesQuery = haystack.includes(normalized);
      const matchesCategory = activeCategory === "For You" || activeCategory === "Trending" || haystack.includes(category);
      return matchesQuery && matchesCategory;
    });
  }, [activeCategory, characters, query]);

  return (
    <PageShell className="space-y-10">
      <Surface className="relative isolate overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-70" />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-end">
          <PageHeader
            icon={Compass}
            title="Find your next character"
            description="Search by mood, genre, personality, or story hook. Choose a presence that feels right, then start with one message."
          />
          <div className="space-y-4">
            <SearchBar value={query} onChange={setQuery} showFilterIcon placeholder="Search characters..." />
            <div className="flex items-center gap-3 rounded-full bg-white/[0.025] px-4 py-3 text-xs leading-5 text-muted-foreground shadow-inset">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span>{filtered.length} characters visible. Try fantasy, mentor, romance, friend, or a specific mood.</span>
            </div>
          </div>
        </div>

        <CategoryChips categories={categories} active={activeCategory} onSelect={setActiveCategory} className="mt-6" />
      </Surface>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-[360px] rounded-[30px] skeleton" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title={characters.length === 0 ? "No characters yet" : "No characters found"}
          description={
            characters.length === 0
              ? "The public catalog is empty now. Create your own character to begin building Velora from your account."
              : "Try a softer mood, a broader genre, or clear the category filter to open the catalog back up."
          }
          action={
            characters.length === 0 ? (
              <Button asChild>
                <Link href="/create-character">
                  <Plus className="h-4 w-4" />
                  Create character
                </Link>
              </Button>
            ) : null
          }
        />
      )}
    </PageShell>
  );
}
