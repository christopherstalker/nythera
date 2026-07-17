"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import { motion } from "motion/react";
import { CharacterBentoGrid } from "@/components/characters/CharacterBentoGrid";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { DISCOVERY_TAGS, displayTagLabel } from "@/lib/character-tags";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
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
  const featuredCharacter = trending[0] ?? activeFeedCharacters[0] ?? characters[0] ?? null;

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
    <PageShell className="codex-explore space-y-10">
      <header className="border-b border-[var(--codex-rule)] pb-7">
        <p className="mb-2 text-[10px] uppercase tracking-[.3em] text-[var(--codex-violet)]">The living index</p>
        <h1 className="font-editorial text-[clamp(3.5rem,8vw,7rem)] font-medium leading-[.82] tracking-[-.045em] text-[var(--codex-ivory)]">Discover</h1>
      </header>
      <FeaturedStage character={featuredCharacter} loading={loading} />

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
        <section className="space-y-4">
          <div className="scrollbar-none overflow-x-auto pb-1">
            <div
            className="inline-flex min-w-max gap-6 border-b border-[var(--codex-rule)]"
            >
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeed(tab.id)}
                  className={cn(
                    "focus-ring h-11 border-b px-1 text-xs font-semibold uppercase tracking-[.16em]",
                    activeFeed === tab.id
                      ? "border-[var(--codex-mint)] text-[var(--codex-mint)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <CharacterBentoGrid title={activeFeedTab.label} characters={activeFeedCharacters.slice(0, 6)} loading={loading} layout="shelf" />
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

function FeaturedStage({ character, loading }: { character: CharacterSummary | null; loading: boolean }) {
  if (loading && !character) {
    return <div className="skeleton min-h-[560px] w-full border-y border-[var(--codex-rule)]" />;
  }

  if (!character) {
    return null;
  }

  const avatarSrc = character.avatarUrl || "/icons/velora-aurora-v4-512.png";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="codex-discovery-stage group relative isolate grid min-h-[560px] overflow-hidden border-y border-[var(--codex-rule)] lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]"
      aria-labelledby="featured-character-name"
    >
      <Image
        src={avatarSrc}
        alt={character.name}
        fill
        priority
        unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
        sizes="(min-width: 1280px) 88rem, 100vw"
        className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-700 group-hover:scale-[1.015] motion-reduce:transition-none lg:left-auto lg:w-[62%]"
        style={{ objectPosition: "70% 20%" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--codex-paper) 0%, color-mix(in oklch, var(--codex-paper) 96%, transparent) 38%, transparent 76%), linear-gradient(0deg, var(--codex-paper) 0%, transparent 54%)"
        }}
      />
      <div className="absolute inset-0 bg-aurora-ambient opacity-35 mix-blend-screen" />

      <div className="relative z-10 flex min-h-[inherit] max-w-xl flex-col justify-end p-6 sm:p-9 lg:justify-center lg:p-12 xl:p-16">
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent-secondary)]">
          <Sparkles className="h-4 w-4" />
          Featured character
        </p>
        <h2 id="featured-character-name" className="font-editorial text-[clamp(4rem,9vw,7.5rem)] font-medium leading-[.78] tracking-[-.055em] text-[var(--codex-ivory)]">
          {character.name}
        </h2>
        <p className="mt-6 line-clamp-3 max-w-lg text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
          {character.description || "A story waiting to begin."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {character.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="orbital-glass rounded-full px-4 py-2 text-sm font-medium text-[var(--text-primary)]">
              {displayTagLabel(tag)}
            </span>
          ))}
        </div>
        <Link
          href={`/character/${character.id}`}
          className="mt-6 inline-flex h-12 w-fit items-center gap-3 rounded-full bg-aurora-primary px-6 text-sm font-semibold text-[var(--text-primary)] no-underline shadow-glow-soft transition hover:-translate-y-0.5 motion-reduce:transition-none"
        >
          View profile
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.section>
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
        className="codex-discovery-dock border-y border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-4 sm:p-5"
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(340px,1.7fr)_minmax(150px,.55fr)_minmax(250px,.8fr)_minmax(300px,1fr)_auto] xl:items-end">
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

          <DockGroup label="Sort" className="hidden xl:grid">
            <select
              aria-label="Sort characters"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as (typeof sortOptions)[number]["id"])}
              className="focus-ring h-10 rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-3 text-xs font-semibold text-[var(--text-primary)]"
            >
              {sortOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </DockGroup>

          <DockGroup label="Rating" className="hidden xl:grid">
            <div className="flex gap-1.5">
              {[0, 3, 4, 4.5].map((value) => (
                <FilterButton key={value} active={ratingMin === value} onClick={() => onRatingChange(value)}>
                  {value === 0 ? "Any" : `${value}+`}
                </FilterButton>
              ))}
            </div>
          </DockGroup>

          <DockGroup label="Age" className="hidden xl:grid">
            <div className="flex gap-1.5">
              {nsfwOptions.map((option) => (
                <FilterButton key={option.id} active={nsfwMode === option.id} onClick={() => onNsfwChange(option.id)}>
                  {option.label}
                </FilterButton>
              ))}
            </div>
          </DockGroup>

          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="explore-extra-filters"
            onClick={() => setFiltersOpen((current) => !current)}
            className="focus-ring hidden h-10 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] xl:flex"
          >
            <SlidersHorizontal className="h-4 w-4" />
            More filters
            {activeFilterCount > 0 ? <span className="text-[var(--accent-secondary)]">{activeFilterCount}</span> : null}
          </button>
        </div>
      </motion.section>

      {filtersOpen ? (
        <motion.div
          id="explore-extra-filters"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="orbital-functional mt-3 hidden gap-5 xl:grid rounded-[var(--radius-surface)] p-4"
        >
          <div className="flex flex-wrap gap-2">
            {quickTags.map((tag) => (
              <TagButton key={tag.slug} active={selectedTags.includes(tag.slug)} onClick={() => onToggleTag(tag.slug)}>
                {displayTagLabel(tag.slug)}
              </TagButton>
            ))}
          </div>
          {hasActiveFilters ? (
            <button type="button" onClick={onReset} className="focus-ring w-fit rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Reset filters
            </button>
          ) : null}
        </motion.div>
      ) : null}

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
            className="orbital-floating fixed inset-x-3 bottom-[calc(var(--bottom-nav-offset)_+_8px)] z-[80] mx-auto flex h-[min(72svh,680px)] max-w-[720px] flex-col overflow-hidden rounded-[28px] p-4 md:bottom-6 md:inset-x-6"
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

function DockGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("gap-1.5", className)}>
      <span className="px-1 text-[11px] font-semibold text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
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
