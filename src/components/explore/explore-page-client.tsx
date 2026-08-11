"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ShieldCheck, SlidersHorizontal, Star, X } from "lucide-react";
import { motion } from "motion/react";
import { CharacterGallery } from "@/components/characters/CharacterGallery";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { DISCOVERY_TAGS, displayTagLabel } from "@/lib/character-tags";
import {
  DEFAULT_DISCOVERY_FILTERS,
  type DiscoveryFilters,
  type DiscoveryNsfwMode,
  type DiscoverySort,
  type DiscoveryTagMatch,
  discoveryFiltersFromSearchParams,
  hasDiscoveryFilters,
  normalizeDiscoveryFilters,
  serializeDiscoveryFilters
} from "@/lib/discovery-query";
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
const STALE_REFRESH_MS = 300_000;

type FeedTabId = (typeof feedTabs)[number]["id"];

async function fetchCharacters(params: URLSearchParams, signal?: AbortSignal) {
  const response = await fetch(`/api/characters?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error("CHARACTER_CATALOG_UNAVAILABLE");
  }
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.characters) ? body.characters : [];
}

export default function ExplorePageClient({
  initialCharacters,
  initialTrending,
  initialRecommended,
  initialFilters
}: {
  initialCharacters: CharacterSummary[];
  initialTrending: CharacterSummary[];
  initialRecommended: CharacterSummary[];
  initialFilters: DiscoveryFilters;
}) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="skeleton h-40 rounded-[var(--radius-xl)]" />
        </PageShell>
      }
    >
      <ExplorePageContent
        initialCharacters={initialCharacters}
        initialTrending={initialTrending}
        initialRecommended={initialRecommended}
        initialFilters={initialFilters}
      />
    </Suspense>
  );
}

function ExplorePageContent({
  initialCharacters,
  initialTrending,
  initialRecommended,
  initialFilters
}: {
  initialCharacters: CharacterSummary[];
  initialTrending: CharacterSummary[];
  initialRecommended: CharacterSummary[];
  initialFilters: DiscoveryFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [characters, setCharacters] = useState<CharacterSummary[]>(initialCharacters);
  const [trending] = useState<CharacterSummary[]>(initialTrending);
  const [recommended] = useState<CharacterSummary[]>(initialRecommended);
  const [filters, setFilters] = useState<DiscoveryFilters>(initialFilters);
  const [queryDraft, setQueryDraft] = useState(initialFilters.query);
  const [activeFeed, setActiveFeed] = useState<FeedTabId>("trending");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const skipInitialRequest = useRef(true);
  const lastRefreshAt = useRef(0);
  const hasActiveFilters = hasDiscoveryFilters(filters);
  const showFeedSections = !hasActiveFilters;
  const isCatalogEmpty = !loading && !loadError && (
    showFeedSections
      ? characters.length === 0 && trending.length === 0 && recommended.length === 0
      : characters.length === 0
  );
  const activeFeedTab = feedTabs.find((tab) => tab.id === activeFeed) ?? feedTabs[0];
  const activeFeedCharacters =
    activeFeed === "recommended" ? recommended : activeFeed === "for-you" ? characters.slice(0, FEED_TAKE) : trending;

  const routeState = searchParams.toString();

  useEffect(() => {
    const routeFilters = discoveryFiltersFromSearchParams(new URLSearchParams(routeState));
    setFilters((current) => (
      serializeDiscoveryFilters(current).toString() === serializeDiscoveryFilters(routeFilters).toString()
        ? current
        : routeFilters
    ));
    setQueryDraft(routeFilters.query);
  }, [routeState]);

  useEffect(() => {
    if (skipInitialRequest.current) {
      skipInitialRequest.current = false;
      lastRefreshAt.current = Date.now();
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);

    async function loadCharacters() {
      try {
        const params = buildCharacterParams(filters, CATALOG_TAKE);
        const nextCharacters = await fetchCharacters(params, controller.signal);
        setCharacters(nextCharacters);
        lastRefreshAt.current = Date.now();
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCharacters();

    return () => controller.abort();
  }, [filters, refreshVersion]);

  useEffect(() => {
    const refresh = () => setRefreshVersion((version) => version + 1);
    const onCharactersUpdated = () => {
      lastRefreshAt.current = 0;
      refresh();
    };
    const refreshWhenStale = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAt.current >= STALE_REFRESH_MS) {
        refresh();
      }
    };
    window.addEventListener("nythera:characters-updated", onCharactersUpdated);
    document.addEventListener("visibilitychange", refreshWhenStale);
    return () => {
      window.removeEventListener("nythera:characters-updated", onCharactersUpdated);
      document.removeEventListener("visibilitychange", refreshWhenStale);
    };
  }, []);

  function commitFilters(patch: Partial<DiscoveryFilters>) {
    const nextFilters = normalizeDiscoveryFilters({ ...filters, ...patch });
    setFilters(nextFilters);
    const nextSearchParams = serializeDiscoveryFilters(nextFilters);
    const queryString = nextSearchParams.toString();
    router.replace(queryString ? `/explore?${queryString}` : "/explore", { scroll: false });
  }

  function submitSearch(nextQuery: string) {
    commitFilters({ query: nextQuery });
  }

  function toggleTag(tag: string) {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter((item) => item !== tag)
      : [...filters.tags, tag].slice(0, 8);
    commitFilters({ tags, tagMatch: tags.length > 1 ? filters.tagMatch : "any" });
  }

  function resetFilters() {
    setQueryDraft("");
    commitFilters(DEFAULT_DISCOVERY_FILTERS);
  }

  return (
    <PageShell className="codex-explore space-y-6 sm:space-y-8">
      <header className="neo-glass-panel relative isolate grid min-h-56 overflow-hidden p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,.55fr)] md:items-end">
        <div className="pointer-events-none absolute -left-16 -top-24 -z-10 h-72 w-72 rounded-full bg-[oklch(var(--color-accent-primary)/.22)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 -z-10 h-80 w-80 rounded-full bg-[oklch(var(--color-accent-secondary)/.14)] blur-3xl" />
        <div className="relative">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.3em] text-[var(--accent-secondary)]">The living index</p>
          <h1 className="font-editorial text-[clamp(3.2rem,7vw,6rem)] font-medium leading-[.82] tracking-[-.05em] text-[var(--text-primary)]">Discover</h1>
        </div>
        <p className="relative mt-8 max-w-md text-sm leading-6 text-[var(--text-secondary)] md:mt-0 md:justify-self-end md:text-right">
          Find a voice, enter a world, and keep the next story within reach.
        </p>
      </header>

      <DiscoveryCommandCenter
        query={queryDraft}
        selectedTags={filters.tags}
        sort={filters.sort}
        ratingMin={filters.ratingMin}
        nsfwMode={filters.nsfw}
        tagMatch={filters.tagMatch}
        hasActiveFilters={hasActiveFilters}
        onQueryChange={setQueryDraft}
        onSearch={submitSearch}
        onToggleTag={toggleTag}
        onSortChange={(sort) => commitFilters({ sort })}
        onRatingChange={(ratingMin) => commitFilters({ ratingMin })}
        onNsfwChange={(nsfw) => commitFilters({ nsfw })}
        onTagMatchChange={(tagMatch) => commitFilters({ tagMatch })}
        onReset={resetFilters}
      />

      <div className="flex min-h-6 items-center justify-between gap-3 text-xs text-[var(--text-muted)]" aria-live="polite">
        <span>{loading ? "Updating results…" : `${characters.length} character${characters.length === 1 ? "" : "s"} found`}</span>
        {loadError ? (
          <button type="button" onClick={() => setRefreshVersion((version) => version + 1)} className="focus-ring text-[var(--codex-mint)] hover:underline">
            Search failed. Try again
          </button>
        ) : null}
      </div>

      {showFeedSections ? (
        <section className="space-y-4">
          <div className="neo-glass-card scrollbar-none overflow-x-auto px-3 pb-0 sm:px-5">
            <div
            className="inline-flex min-w-max gap-6"
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
          <CharacterGallery title={activeFeedTab.label} characters={activeFeedCharacters.slice(0, FEED_TAKE)} loading={loading} />
        </section>
      ) : null}

      {!showFeedSections && (loading || characters.length > 0) ? (
        <CharacterGallery characters={characters} loading={loading} />
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
  tagMatch,
  hasActiveFilters,
  onQueryChange,
  onSearch,
  onToggleTag,
  onSortChange,
  onRatingChange,
  onNsfwChange,
  onTagMatchChange,
  onReset
}: {
  query: string;
  selectedTags: string[];
  sort: DiscoverySort;
  ratingMin: number;
  nsfwMode: DiscoveryNsfwMode;
  tagMatch: DiscoveryTagMatch;
  hasActiveFilters: boolean;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onSortChange: (value: DiscoverySort) => void;
  onRatingChange: (value: number) => void;
  onNsfwChange: (value: DiscoveryNsfwMode) => void;
  onTagMatchChange: (value: DiscoveryTagMatch) => void;
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
        className="neo-glass-panel codex-discovery-dock relative z-30 p-3 sm:p-5"
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
              onChange={(event) => onSortChange(event.target.value as DiscoverySort)}
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
          className="neo-glass-panel mt-3 hidden gap-5 rounded-[var(--radius-surface)] p-4 xl:grid"
        >
          <div className="flex flex-wrap gap-2">
            {quickTags.map((tag) => (
              <TagButton key={tag.slug} active={selectedTags.includes(tag.slug)} onClick={() => onToggleTag(tag.slug)}>
                {displayTagLabel(tag.slug)}
              </TagButton>
            ))}
          </div>
          {selectedTags.length > 1 ? (
            <TagMatchControl value={tagMatch} onChange={onTagMatchChange} />
          ) : null}
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
                tagMatch={tagMatch}
                hasActiveFilters={hasActiveFilters}
                onToggleTag={onToggleTag}
                onSortChange={onSortChange}
                onRatingChange={onRatingChange}
                onNsfwChange={onNsfwChange}
                onTagMatchChange={onTagMatchChange}
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
  tagMatch,
  hasActiveFilters,
  onToggleTag,
  onSortChange,
  onRatingChange,
  onNsfwChange,
  onTagMatchChange,
  onReset
}: {
  selectedTags: string[];
  sort: DiscoverySort;
  ratingMin: number;
  nsfwMode: DiscoveryNsfwMode;
  tagMatch: DiscoveryTagMatch;
  hasActiveFilters: boolean;
  onToggleTag: (tag: string) => void;
  onSortChange: (value: DiscoverySort) => void;
  onRatingChange: (value: number) => void;
  onNsfwChange: (value: DiscoveryNsfwMode) => void;
  onTagMatchChange: (value: DiscoveryTagMatch) => void;
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

      {selectedTags.length > 1 ? (
        <TagMatchControl value={tagMatch} onChange={onTagMatchChange} />
      ) : null}

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

function buildCharacterParams(filters: DiscoveryFilters, take: number) {
  const params = serializeDiscoveryFilters(filters);
  params.set("take", String(take));
  return params;
}

function TagMatchControl({ value, onChange }: { value: DiscoveryTagMatch; onChange: (value: DiscoveryTagMatch) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Tag matching</legend>
      <span className="mr-1 text-xs font-semibold text-[var(--text-muted)]">Selected tags:</span>
      <FilterButton active={value === "any"} onClick={() => onChange("any")}>Match any</FilterButton>
      <FilterButton active={value === "all"} onClick={() => onChange("all")}>Match all</FilterButton>
    </fieldset>
  );
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
        "focus-ring h-9 rounded-sm border px-3 font-mono text-[10px] font-medium uppercase tracking-[.12em] active:scale-[.98]",
        active
          ? "border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]"
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
        "focus-ring rounded-sm border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[.12em] active:scale-[.98]",
        active
          ? "border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]"
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
