"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";

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
    <div className="container py-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card-glow">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-character text-xs font-semibold uppercase">Explore</span>
            </div>
            <h1 className="mt-3 text-[32px] font-bold leading-10 tracking-tight">Find your next character</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
              Public characters appear after moderation approval. Search names, descriptions, and tags without leaving the immersive chat flow.
            </p>
          </div>

          <label className="relative w-full xl:w-[420px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="focus-ring h-12 w-full rounded-full border border-border bg-[hsl(var(--input))] px-11 text-sm transition focus:border-primary"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search characters..."
            />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto pb-1">
          <div className="flex min-w-fit gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition duration-200 ${
                  activeCategory === category
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((character) => (
          <CharacterCard key={character.id} character={character} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center">
          <Search className="mx-auto h-12 w-12 text-border" />
          <p className="mt-4 text-base text-muted-foreground">No characters match this search.</p>
        </div>
      ) : null}
    </div>
  );
}
