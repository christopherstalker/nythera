"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronsUpDown, Plus, Search } from "lucide-react";
import { CharacterGrid } from "@/components/characters/CharacterGrid";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { CategoryPill } from "@/components/ui/category-pill";
import { PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";

const categories = ["Explore", "Video", "Today", "Trending", "Romance", "Fantasy", "Anime", "Friend", "Roleplay"];
const genderFilters = ["Male", "Female", "All"];

export default function ExplorePage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Explore");
  const [genderIndex, setGenderIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const hasActiveFilters = query.trim().length > 0 || activeCategory !== "Explore";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ take: "50" });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (activeCategory === "Trending") {
      params.set("sort", "trending");
    } else if (activeCategory === "Today") {
      params.set("sort", "new");
    } else if (activeCategory !== "Explore" && activeCategory !== "Video") {
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
    <PageShell className="max-w-[1480px] space-y-5 bg-[#050505] px-2 pt-4 md:px-5 lg:px-8">
      <div className="flex items-center gap-3 md:gap-8">
        <SearchBar value={query} onChange={setQuery} placeholder="Verity" className="min-w-0 flex-1 md:max-w-[760px]" />
        <button
          type="button"
          onClick={() => setGenderIndex((current) => (current + 1) % genderFilters.length)}
          className="focus-ring ml-auto inline-flex h-16 shrink-0 items-center gap-1 rounded-[20px] px-2 text-[28px] font-black leading-none text-[#a8a8a8] transition hover:text-white md:px-4 md:text-[30px]"
        >
          {genderFilters[genderIndex]}
          <ChevronsUpDown className="h-6 w-6" />
        </button>
      </div>

      <div className="scrollbar-none overflow-x-auto">
        <div className="flex w-max items-center gap-6 px-1 pb-1 md:gap-8">
          {categories.map((category) => (
            <CategoryPill key={category} label={category} active={category === activeCategory} onClick={() => setActiveCategory(category)} />
          ))}
          <ChevronDown className="h-5 w-5 shrink-0 text-[#777]" />
        </div>
      </div>

      {loading || characters.length > 0 ? (
        <CharacterGrid characters={characters} loading={loading} />
      ) : (
        <div className="mt-12 flex min-h-[45vh] flex-col items-center justify-center rounded-[8px] bg-[#101010] px-6 py-12 text-center shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] text-white">
            <Search className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-[34px] font-black leading-none text-white">{hasActiveFilters ? "No matches" : "No characters yet"}</h1>
          <p className="mt-3 max-w-sm text-[18px] font-bold leading-6 text-[#888]">
            {hasActiveFilters ? "Try another name, mood, or category." : "Only real user-created characters appear here. Create the first public character to fill this feed."}
          </p>
          {!hasActiveFilters ? (
            <Link
              href="/create-character"
              className="focus-ring mt-7 inline-flex h-14 items-center gap-2 rounded-full bg-[#fff200] px-6 text-[17px] font-black text-black no-underline transition hover:brightness-105"
            >
              <Plus className="h-5 w-5 stroke-[3]" />
              Create
            </Link>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
