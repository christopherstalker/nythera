"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import { motion } from "motion/react";
import { CharacterBentoGrid } from "@/components/characters/CharacterBentoGrid";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { DISCOVERY_TAGS, displayTagLabel } from "@/lib/character-tags";
import { springSoft } from "@/lib/motion";
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

const CATALOG_TAKE = 50;
const FEED_TAKE = 12;

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
  const hasActiveFilters = Boolean(query.trim()) || Boolean(selectedTags.length) || sort !== "trending" || ratingMin > 0 || nsfwMode !== "safe";
  const showFeedSections = !hasActiveFilters;
  const isCatalogEmpty = !loading && characters.length === 0 && trending.length === 0 && recommended.length === 0;
  const activeFeedTab = feedTabs.find((tab) => tab.id === activeFeed) ?? feedTabs[0];
  const activeFeedCharacters =
    activeFeed === "recommended" ? recommended : activeFeed === "for-you" ? characters.slice(0, FEED_TAKE) : trending;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    async function loadCharacters() {
      try {
        const params = buildCharacterParams({ query, selectedTags, sort, ratingMin, nsfwMode, take: String(CATALOG_TAKE) });
        const nextCharacters = await fetchCharacters(params, controller.signal);
        setCharacters(nextCharacters);

        if (!showFeedSections) {
          setTrending([]);
          setRecommended([]);
          return;
        }

        const [nextTrending, nextRecommended] = await Promise.all([
          fetchCharacters(new URLSearchParams({ take: String(FEED_TAKE), sort: "trending", nsfw: "safe" }), controller.signal),
          fetchCharacters(new URLSearchParams({ take: String(FEED_TAKE), sort: "new", nsfw: "safe" }), controller.signal)
        ]);
        setTrending(nextTrending);
        setRecommended(nextRecommended);
      } catch {
        if (!controller.signal.aborted) {
          setCharacters([]);
          setTrending([]);
          setRecommended([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCharacters();

    return () => controller.abort();
  }, [nsfwMode, query, ratingMin, selectedTags, showFeedSections, sort]);

  useEffect(() => {
    const refresh = async () => {
      setCharacters(await fetchCharacters(buildCharacterParams({ query, selectedTags, sort, ratingMin, nsfwMode, take: String(CATALOG_TAKE) })));
      if (showFeedSections) {
        const [nextTrending, nextRecommended] = await Promise.all([
          fetchCharacters(new URLSearchParams({ take: String(FEED_TAKE), sort: "trending", nsfw: "safe" })),
          fetchCharacters(new URLSearchParams({ take: String(FEED_TAKE), sort: "new", nsfw: "safe" }))
        ]);
        setTrending(nextTrending);
        setRecommended(nextRecommended);
      }
    };

    const onCharactersUpdated = () => void refresh();
    window.addEventListener("nythera:characters-updated", onCharactersUpdated);
    return () => window.removeEventListener("nythera:characters-updated", onCharactersUpdated);
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
    <PageShell className="space-y-8 px-4 pt-6 sm:px-6 md:pt-8">
      <DiscoveryCommandCenter
        query={query}
        selectedTags={selectedTags}
        sort={sort}
        ratingMin={ratingMin}
        nsfwMode={nsfwMode}
        hasActiveFilters={hasActiveFilters}
        onQueryChange={setQuery}
        onSearch={submitSearch}
        onToggleTag={toggleTag}
        onSortChange={setSort}
        onRatingChange={setRatingMin}
        onNsfwChange={setNsfwMode}
        onReset={resetFilters}
      />

      {showFeedSections ? (
        <section className="space-y-5">
          <div className="scrollbar-none overflow-x-auto pb-1">
            <div
              className="inline-flex min-w-max gap-1 rounded-[var(--radius-pill)] border border-[var(--border-subtle)] p-1"
              style={{
                background: "color-mix(in oklch, var(--color-surface) 70%, transparent)",
                boxShadow: "var(--glass-highlight)",
                backdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
                WebkitBackdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))"
              }}
            >
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeed(tab.id)}
                  className={cn(
                    "focus-ring h-10 rounded-[var(--radius-pill)] px-4 text-sm font-semibold",
                    activeFeed === tab.id
                      ? "bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <CharacterBentoGrid title={activeFeedTab.label} characters={activeFeedCharacters} loading={loading} />
        </section>
      ) : null}

      {!showFeedSections && (loading || characters.length > 0) ? (
        <CharacterBentoGrid characters={characters} loading={loading} />
      ) : null}

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

function DiscoveryCommandCenter({
  query,
  selectedTags,
  sort,
  ratingMin,
  nsfwMode,
  hasActiveFilters,
  onQueryChange,
  onSearch,
  onToggleTag,
  onSortChange,
  onRatingChange,
  onNsfwChange,
  onReset
}: {
  query: string;
  selectedTags: string[];
  sort: (typeof sortOptions)[number]["id"];
  ratingMin: number;
  nsfwMode: (typeof nsfwOptions)[number]["id"];
  hasActiveFilters: boolean;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onSortChange: (value: (typeof sortOptions)[number]["id"]) => void;
  onRatingChange: (value: number) => void;
  onNsfwChange: (value: (typeof nsfwOptions)[number]["id"]) => void;
  onReset: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount =
    selectedTags.length + (sort !== "trending" ? 1 : 0) + (ratingMin > 0 ? 1 : 0) + (nsfwMode !== "safe" ? 1 : 0);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };

    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [filtersOpen]);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="relative isolate overflow-hidden rounded-[28px] border border-[var(--border-subtle)] p-4 sm:p-5 lg:p-6"
        style={{
          background: "color-mix(in oklch, var(--color-surface) 68%, transparent)",
          boxShadow: "var(--shadow-card)",
          backdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturation))",
          WebkitBackdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturation))"
        }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora-ambient opacity-60" />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundSize: "256px 256px"
          }}
        />

        <div className="grid gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft">
                <Sparkles className="h-5 w-5" />
              </span>
              <h1 className="text-4xl font-semibold leading-none text-[var(--text-primary)] sm:text-5xl">Explore</h1>
            </div>
            <Button asChild className="self-start bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft lg:self-auto">
              <Link href="/create-character">
                <Plus className="h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>

          <SearchBar
            value={query}
            onChange={onQueryChange}
            onSubmit={onSearch}
            placeholder="Search characters, tags, moods..."
            showFilterIcon
            onFilterClick={() => setFiltersOpen(true)}
            filterActive={activeFilterCount > 0}
            filterExpanded={filtersOpen}
            filterCount={activeFilterCount}
            filterControls="explore-filter-drawer"
          />

          <div className="hidden gap-5 xl:grid">
            <DiscoveryFilterControls
              selectedTags={selectedTags}
              sort={sort}
              ratingMin={ratingMin}
              nsfwMode={nsfwMode}
              hasActiveFilters={hasActiveFilters}
              onToggleTag={onToggleTag}
              onSortChange={onSortChange}
              onRatingChange={onRatingChange}
              onNsfwChange={onNsfwChange}
              onReset={onReset}
            />
          </div>
        </div>
      </motion.section>

      {filtersOpen ? (
        <div className="xl:hidden">
          <button
            type="button"
            aria-label="Close search filters"
            onClick={() => setFiltersOpen(false)}
            className="fixed inset-0 z-[70] bg-black/70"
          />
          <motion.aside
            id="explore-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Search filters"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={springSoft}
            className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-offset)_+_8px)] z-[80] mx-auto flex h-[min(72svh,680px)] max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-elevated)] md:bottom-6 md:inset-x-6"
            style={{
              background: "color-mix(in oklch, var(--bg-surface) 86%, transparent)",
              backdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturation))",
              WebkitBackdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturation))"
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">Search filters</p>
                <p className="text-xs text-[var(--text-muted)]">Sort, rating, age, and tags</p>
              </div>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
                className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="chat-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              <DiscoveryFilterControls
                selectedTags={selectedTags}
                sort={sort}
                ratingMin={ratingMin}
                nsfwMode={nsfwMode}
                hasActiveFilters={hasActiveFilters}
                onToggleTag={onToggleTag}
                onSortChange={onSortChange}
                onRatingChange={onRatingChange}
                onNsfwChange={onNsfwChange}
                onReset={onReset}
              />
            </div>
          </motion.aside>
        </div>
      ) : null}
    </>
  );
}

function DiscoveryFilterControls({
  selectedTags,
  sort,
  ratingMin,
  nsfwMode,
  hasActiveFilters,
  onToggleTag,
  onSortChange,
  onRatingChange,
  onNsfwChange,
  onReset
}: {
  selectedTags: string[];
  sort: (typeof sortOptions)[number]["id"];
  ratingMin: number;
  nsfwMode: (typeof nsfwOptions)[number]["id"];
  hasActiveFilters: boolean;
  onToggleTag: (tag: string) => void;
  onSortChange: (value: (typeof sortOptions)[number]["id"]) => void;
  onRatingChange: (value: number) => void;
  onNsfwChange: (value: (typeof nsfwOptions)[number]["id"]) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="grid gap-3 xl:grid-cols-3">
        <FilterGroup icon={SlidersHorizontal} label="Sort">
          {sortOptions.map((option) => (
            <FilterButton key={option.id} active={sort === option.id} onClick={() => onSortChange(option.id)}>
              {option.label}
            </FilterButton>
          ))}
        </FilterGroup>
        <FilterGroup icon={Star} label="Rating">
          {[0, 3, 4, 4.5].map((value) => (
            <FilterButton key={value} active={ratingMin === value} onClick={() => onRatingChange(value)}>
              {value === 0 ? "Any" : `${value}+`}
            </FilterButton>
          ))}
        </FilterGroup>
        <FilterGroup icon={ShieldCheck} label="Age">
          {nsfwOptions.map((option) => (
            <FilterButton key={option.id} active={nsfwMode === option.id} onClick={() => onNsfwChange(option.id)}>
              {option.label}
            </FilterButton>
          ))}
        </FilterGroup>
      </div>

      <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <div className="flex w-max max-w-full flex-wrap gap-2">
          {quickTags.map((tag) => (
            <TagButton
              key={tag.slug}
              active={selectedTags.includes(tag.slug)}
              onClick={() => onToggleTag(tag.slug)}
            >
              {displayTagLabel(tag.slug)}
            </TagButton>
          ))}
        </div>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="focus-ring justify-self-start rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          style={{ background: "color-mix(in oklch, var(--bg-surface) 54%, transparent)" }}
        >
          Reset filters
        </button>
      ) : null}
    </>
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

function FilterGroup({ icon: Icon, label, children }: { icon: typeof SlidersHorizontal; label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[20px] border border-[var(--border-subtle)] p-3"
      style={{
        background: "color-mix(in oklch, var(--color-canvas) 34%, transparent)",
        boxShadow: "var(--glass-highlight)"
      }}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
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
        "focus-ring h-9 rounded-[var(--radius-pill)] border px-3 text-xs font-semibold active:scale-95",
        active
          ? "border-[var(--border-strong)] bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
      style={active ? undefined : { background: "color-mix(in oklch, var(--color-surface) 48%, transparent)" }}
    >
      {children}
    </button>
  );
}

function TagButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring rounded-full border px-3 py-1.5 text-xs font-medium active:scale-95",
        active
          ? "border-[var(--border-strong)] bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
      style={active ? undefined : {
        background: "color-mix(in oklch, var(--color-surface) 44%, transparent)",
        backdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
        WebkitBackdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))"
      }}
    >
      {children}
    </button>
  );
}
