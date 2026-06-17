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
import { DISCOVERY_TAGS, displayTagLabel } from "@/lib/character-tags";
import { cn } from "@/lib/utils";

const quickTags = DISCOVERY_TAGS.slice(0, 18);
const sortOptions = [
  { id: "trending", label: "Trending" },
  { id: "top-rated", label: "Top rated" },
  { id: "new", label: "New" }
] as const;
const nsfwOptions = [
  { id: "safe", label: "Safe" },
  { id: "include", label: "Include 18+" },
  { id: "only", label: "Only 18+" }
] as const;
const feedTabs = [
  { id: "trending", label: "Trending" },
  { id: "recommended", label: "Recommended" },
  { id: "for-you", label: "For You" }
] as const;

type FeedTabId = (typeof feedTabs)[number]["id"];

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<(typeof sortOptions)[number]["id"]>("trending");
  const [activeFeed, setActiveFeed] = useState<FeedTabId>("trending");
  const [ratingMin, setRatingMin] = useState(0);
  const [nsfwMode, setNsfwMode] = useState<(typeof nsfwOptions)[number]["id"]>("safe");
  const [loading, setLoading] = useState(true);
  const hasActiveFilters = query.trim().length > 0 || selectedTags.length > 0 || sort !== "trending" || ratingMin > 0 || nsfwMode !== "safe";
  const showFeedSections = !hasActiveFilters;
  const isCatalogEmpty = !loading && characters.length === 0 && trending.length === 0 && recommended.length === 0;
  const activeFeedTab = feedTabs.find((tab) => tab.id === activeFeed) ?? feedTabs[0];
  const activeFeedCharacters =
    activeFeed === "recommended" ? recommended : activeFeed === "for-you" ? characters.slice(0, 12) : trending;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = buildCharacterParams({ query, selectedTags, sort, ratingMin, nsfwMode, take: "50" });
    const tasks = [fetchCharacters(params, controller.signal).then(setCharacters)];

    if (showFeedSections) {
      tasks.push(
        fetchCharacters(new URLSearchParams({ take: "12", sort: "trending", nsfw: "safe" }), controller.signal).then(setTrending),
        fetchCharacters(new URLSearchParams({ take: "12", sort: "new", nsfw: "safe" }), controller.signal).then(setRecommended)
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
  }, [nsfwMode, query, ratingMin, selectedTags, showFeedSections, sort]);

  useEffect(() => {
    const refresh = () => {
      void fetchCharacters(buildCharacterParams({ query, selectedTags, sort, ratingMin, nsfwMode, take: "50" })).then(setCharacters);
      if (showFeedSections) {
        void fetchCharacters(new URLSearchParams({ take: "12", sort: "trending", nsfw: "safe" })).then(setTrending);
        void fetchCharacters(new URLSearchParams({ take: "12", sort: "new", nsfw: "safe" })).then(setRecommended);
      }
    };

    window.addEventListener("nythera:characters-updated", refresh);
    return () => window.removeEventListener("nythera:characters-updated", refresh);
  }, [nsfwMode, query, ratingMin, selectedTags, showFeedSections, sort]);

  function submitSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    setQuery(trimmed);
    router.replace(trimmed ? `/explore?q=${encodeURIComponent(trimmed)}` : "/explore");
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 8)));
  }

  function resetFilters() {
    setSelectedTags([]);
    setSort("trending");
    setRatingMin(0);
    setNsfwMode("safe");
    setQuery("");
    router.replace("/explore");
  }

  return (
    <PageShell className="space-y-6">
      <Surface className="relative isolate overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-60" />
        <PageHeader
          title="Explore"
          description="Discover chat-ready characters with synced tags, ratings, and safer discovery filters."
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
          placeholder="Search characters, tags, moods..."
          showFilterIcon
        />
      </Surface>

      <div className="scrollbar-none overflow-x-auto">
        <div className="flex w-max gap-2 pb-1">
          {quickTags.slice(0, 10).map((tag) => (
            <CategoryPill key={tag.slug} label={tag.label} active={selectedTags.includes(tag.slug)} onClick={() => toggleTag(tag.slug)} />
          ))}
        </div>
      </div>

      <Surface className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-start">
          <div className="grid gap-3">
            <FilterGroup label="Sort">
              {sortOptions.map((option) => (
                <FilterButton key={option.id} active={sort === option.id} onClick={() => setSort(option.id)}>
                  {option.label}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="Minimum rating">
              {[0, 3, 4, 4.5].map((value) => (
                <FilterButton key={value} active={ratingMin === value} onClick={() => setRatingMin(value)}>
                  {value === 0 ? "Any" : `${value}+`}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="Age filter">
              {nsfwOptions.map((option) => (
                <FilterButton key={option.id} active={nsfwMode === option.id} onClick={() => setNsfwMode(option.id)}>
                  {option.label}
                </FilterButton>
              ))}
            </FilterGroup>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={resetFilters}>
              Reset filters
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggleTag(tag.slug)}
              className={cn(
                "focus-ring rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-medium transition active:scale-95",
                selectedTags.includes(tag.slug)
                  ? "border-transparent bg-[var(--accent-purple-soft)] text-[var(--text-primary)] shadow-[var(--glass-highlight)]"
                  : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[rgb(var(--accent-rgb)_/_0.35)] hover:text-[var(--text-primary)]"
              )}
            >
              {displayTagLabel(tag.slug)}
            </button>
          ))}
        </div>
      </Surface>

      {showFeedSections ? (
        <section className="space-y-4">
          <div className="scrollbar-none overflow-x-auto">
            <div className="inline-flex min-w-max gap-2 rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--glass-highlight)] backdrop-blur-xl">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeed(tab.id)}
                  className={cn(
                    "focus-ring h-10 rounded-[var(--radius-pill)] px-4 text-sm font-semibold transition-colors",
                    activeFeed === tab.id
                      ? "bg-[var(--accent-purple-soft)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <CharacterRow title={activeFeedTab.label} characters={activeFeedCharacters} loading={loading} />
        </section>
      ) : null}

      {!showFeedSections && (loading || characters.length > 0) ? <CharacterGrid characters={characters} loading={loading} /> : null}

      {!loading && isCatalogEmpty ? (
        <EmptyState
          icon={Search}
          title={hasActiveFilters ? "No characters found" : "No public characters yet"}
          description={hasActiveFilters ? "Try another character name, mood, rating, or tag." : "The public catalog is empty right now. Create a character to start building Nythera."}
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

function buildCharacterParams({
  query,
  selectedTags,
  sort,
  ratingMin,
  nsfwMode,
  take
}: {
  query: string;
  selectedTags: string[];
  sort: string;
  ratingMin: number;
  nsfwMode: string;
  take: string;
}) {
  const params = new URLSearchParams({ take, sort, nsfw: nsfwMode });
  if (query.trim()) {
    params.set("q", query.trim());
  }
  selectedTags.forEach((tag) => params.append("tag", tag));
  if (ratingMin > 0) {
    params.set("ratingMin", String(ratingMin));
  }
  return params;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring h-9 rounded-[var(--radius-pill)] border px-3 text-xs font-semibold transition active:scale-95",
        active
          ? "border-transparent bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-glow-soft)]"
          : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}
