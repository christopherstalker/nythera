"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass, Search, Sparkles, TrendingUp } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { CategoryChips } from "@/components/ui/category-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface, SurfaceMuted } from "@/components/ui/page";
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

const demoCharacters: Character[] = [
  {
    id: "demo-mira-of-the-ash-library",
    name: "Mira of the Ash Library",
    description: "A careful fantasy archivist who remembers quests, debts, rumors, and the user's choices across sessions.",
    tags: ["fantasy", "roleplay", "lore"],
    likes: 128,
    ratingAverage: 4.8
  },
  {
    id: "demo-voss-habit-coach",
    name: "Voss, Habit Coach",
    description: "A practical accountability coach with direct feedback, weekly planning, and preference-aware encouragement.",
    tags: ["coach", "productivity"],
    likes: 93,
    ratingAverage: 4.6
  },
  {
    id: "demo-ari-next-door",
    name: "Ari Next Door",
    description: "A warm friend persona focused on casual check-ins, light jokes, and remembering personal details safely.",
    tags: ["friend", "casual"],
    likes: 76,
    ratingAverage: 4.5
  }
];

const categories = ["For You", "Trending", "Romance", "Fantasy", "Anime", "Coach", "Friend", "Roleplay"];

export default function ExplorePage() {
  const [characters, setCharacters] = useState<Character[]>(demoCharacters);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("For You");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/characters?take=36", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        if (Array.isArray(body.characters) && body.characters.length > 0) {
          setCharacters(body.characters);
        }
      })
      .catch(() => undefined);
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
    <PageShell className="space-y-6">
      <Surface className="overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-end">
          <PageHeader
            icon={Compass}
            title="Find your next character"
            description="Search by mood, genre, personality, or story hook. Public characters appear after moderation approval."
          />
          <div className="space-y-3">
            <SearchBar value={query} onChange={setQuery} showFilterIcon placeholder="Search characters, tags, creators..." />
            <div className="grid gap-3 sm:grid-cols-2">
              <SurfaceMuted className="flex items-center gap-3 px-4 py-3">
                <TrendingUp className="h-4 w-4 text-[#f0a8c8]" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Trending now</p>
                  <p className="text-xs text-muted-foreground">Fantasy, friend, coach</p>
                </div>
              </SurfaceMuted>
              <SurfaceMuted className="flex items-center gap-3 px-4 py-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{filtered.length} visible</p>
                  <p className="text-xs text-muted-foreground">Filtered characters</p>
                </div>
              </SurfaceMuted>
            </div>
          </div>
        </div>

        <CategoryChips categories={categories} active={activeCategory} onSelect={setActiveCategory} className="mt-6" />
      </Surface>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No characters found"
          description="Try a softer mood, a broader genre, or clear the category filter to open the catalog back up."
        />
      )}
    </PageShell>
  );
}
