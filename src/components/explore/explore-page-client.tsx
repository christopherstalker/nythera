"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ShieldCheck, SlidersHorizontal, Star, X } from "lucide-react";
import { motion } from "motion/react";
import { CharacterGallery } from "@/components/characters/CharacterGallery";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { type CharacterTagOption, displayTagLabel } from "@/lib/character-tags";
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
  initialFilters,
  tagOptions
}: {
  initialCharacters: CharacterSummary[];
  initialTrending: CharacterSummary[];
  initialRecommended: CharacterSummary[];
  initialFilters: DiscoveryFilters;
  tagOptions: CharacterTagOption[];
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
        tagOptions={tagOptions}
      />
    </Suspense>
  );
}

function ExplorePageContent({
  initialCharacters,
  initialTrending,
  initialRecommended,
  initialFilters,
  tagOptions
}: {
  initialCharacters: CharacterSummary[];
  initialTrending: CharacterSummary[];
  initialRecommended: CharacterSummary[];
  initialFilters: DiscoveryFilters;
  tagOptions: CharacterTagOption[];
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
  const isCatalogEmpty =
    !loading &&
    !loadError &&
    (showFeedSections
      ? characters.length === 0 && trending.length === 0 && recommended.length === 0
      : characters.length === 0);
  const activeFeedTab = feedTabs.find((tab) => tab.id === activeFeed) ?? feedTabs[0];
  const activeFeedCharacters =
    activeFeed === "recommended" ? recommended : activeFeed === "for-you" ? characters.slice(0, FEED_TAKE) : trending;

  const routeState = searchParams.toString();

  useEffect(() => {
    const routeFilters = discoveryFiltersFromSearchParams(new URLSearchParams(routeState));
    setFilters((current) =>
      serializeDiscoveryFilters(current).toString() === serializeDiscoveryFilters(routeFilters).toString()
        ? current
        : routeFilters
    );
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
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--codex-rule)] pb-6">
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--codex-mint)]">
            The living index
          </p>
          <h1 className="font-editorial text-[clamp(3rem,5vw,4.5rem)] font-medium leading-none tracking-[-.035em] text-[var(--text-primary)]">
            Discover your next story.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Familiar faces. Unexpected worlds. A character for every kind of story.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/create-character">
            <Plus className="h-4 w-4" /> Create character
          </Link>
        </Button>
      </header>

      <DiscoveryCommandCenter
        query={queryDraft}
        selectedTags={filters.tags}
        sort={filters.sort}
        ratingMin={filters.ratingMin}
        nsfwMode={filters.nsfw}
        tagMatch={filters.tagMatch}
        hasActiveFilters={hasActiveFilters}
        tagOptions={tagOptions}
        onQueryChange={setQueryDraft}
        onSearch={submitSearch}
        onToggleTag={toggleTag}
        onSortChange={(sort) => commitFilters({ sort })}
        onRatingChange={(ratingMin) => commitFilters({ ratingMin })}
        onNsfwChange={(nsfw) => commitFilters({ nsfw })}
        onTagMatchChange={(tagMatch) => commitFilters({ tagMatch })}
        onReset={resetFilters}
      />

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {filters.query ? (
            <button
              type="button"
              onClick={() => {
                setQueryDraft("");
                commitFilters({ query: "" });
              }}
              className="codex-theme-chip focus-ring gap-2"
              aria-label={`Remove search ${filters.query}`}
            >
              “{filters.query}” <X className="h-3 w-3" />
            </button>
          ) : null}
          {filters.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="codex-theme-chip focus-ring gap-2"
              aria-label={`Remove ${displayTagLabel(tag)} filter`}
            >
              {displayTagLabel(tag)} <X className="h-3 w-3" />
            </button>
          ))}
          {filters.ratingMin > 0 ? <span className="codex-theme-chip">Rating {filters.ratingMin}+</span> : null}
          {filters.nsfw !== "safe" ? (
            <span className="codex-theme-chip">{nsfwOptions.find((option) => option.id === filters.nsfw)?.label}</span>
          ) : null}
          <button
            type="button"
            onClick={resetFilters}
            className="focus-ring min-h-11 px-2 text-xs text-[var(--codex-mint)]"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div
        className="flex min-h-6 items-center justify-between gap-3 text-xs text-[var(--text-muted)]"
        aria-live="polite"
      >
        <span>
          {loading ? "Updating results…" : `${characters.length} character${characters.length === 1 ? "" : "s"} found`}
        </span>
        {loadError ? (
          <button
            type="button"
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="focus-ring text-[var(--codex-mint)] hover:underline"
          >
            Search failed. Try again
          </button>
        ) : null}
      </div>

      {showFeedSections ? (
        <section className="space-y-4">
          <div className="scrollbar-none overflow-x-auto border-b border-[var(--codex-rule)]">
            <div className="inline-flex min-w-max gap-6">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeed(tab.id)}
                  aria-pressed={activeFeed === tab.id}
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
          <CharacterGallery
            title={activeFeedTab.label}
            characters={activeFeedCharacters.slice(0, FEED_TAKE)}
            loading={loading}
          />
        </section>
      ) : null}

      {!showFeedSections && (loading || characters.length > 0) ? (
        <CharacterGallery characters={characters} loading={loading} />
      ) : null}

      {!loading && isCatalogEmpty ? (
        <EmptyState
          icon={Search}
          title={hasActiveFilters ? "No characters found" : "No public characters yet"}
          description={
            hasActiveFilters
              ? "Try another character name, mood, rating, or tag."
              : "The public catalog is empty right now. Create a character to start building Nythera."
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
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
  tagOptions,
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
  tagOptions: CharacterTagOption[];
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
  const [tagQuery, setTagQuery] = useState("");
  const [compactViewport, setCompactViewport] = useState(false);
  const filterTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const updateViewport = () => setCompactViewport(!desktop.matches);
    updateViewport();
    desktop.addEventListener("change", updateViewport);
    return () => desktop.removeEventListener("change", updateViewport);
  }, []);
  const visibleTags = useMemo(() => {
    const query = tagQuery.trim().toLocaleLowerCase();
    const selected = new Set(selectedTags);
    const matching = tagOptions.filter(
      (tag) => !query || tag.label.toLocaleLowerCase().includes(query) || tag.slug.includes(query)
    );
    return [
      ...matching.filter((tag) => selected.has(tag.slug)),
      ...matching.filter((tag) => !selected.has(tag.slug))
    ].slice(0, query ? 40 : 24);
  }, [selectedTags, tagOptions, tagQuery]);
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
        initial={false}
        transition={springSoft}
        className="codex-discovery-dock relative z-30 rounded-xl border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-3 sm:p-4"
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_auto] xl:items-end">
          <SearchBar
            value={query}
            onChange={onQueryChange}
            onSubmit={onSearch}
            placeholder="Search characters, tags, moods..."
            showFilterIcon
            onFilterClick={() => {
              filterTriggerRef.current = document.activeElement as HTMLElement;
              setFiltersOpen(true);
            }}
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
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
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
          <DiscoveryFilterControls
            selectedTags={selectedTags}
            sort={sort}
            ratingMin={ratingMin}
            nsfwMode={nsfwMode}
            tagMatch={tagMatch}
            hasActiveFilters={hasActiveFilters}
            tagOptions={visibleTags}
            tagQuery={tagQuery}
            onTagQueryChange={setTagQuery}
            onToggleTag={onToggleTag}
            onSortChange={onSortChange}
            onRatingChange={onRatingChange}
            onNsfwChange={onNsfwChange}
            onTagMatchChange={onTagMatchChange}
            onReset={onReset}
          />
        </motion.div>
      ) : null}

      <Dialog.Root open={filtersOpen && compactViewport} onOpenChange={setFiltersOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" />
          <Dialog.Content
            id="explore-filter-drawer"
            aria-describedby="explore-filter-description"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              filterTriggerRef.current?.focus();
            }}
            className="orbital-floating fixed inset-x-3 bottom-[calc(var(--bottom-nav-offset)_+_8px)] z-[100] mx-auto flex h-[min(72svh,680px)] max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[var(--codex-rule)] p-4 md:bottom-6 md:inset-x-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                  Search filters
                </Dialog.Title>
                <Dialog.Description id="explore-filter-description" className="text-xs text-[var(--text-muted)]">
                  Sort, rating, age, and tags
                </Dialog.Description>
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
            <div className="chat-scroll min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <DiscoveryFilterControls
                selectedTags={selectedTags}
                sort={sort}
                ratingMin={ratingMin}
                nsfwMode={nsfwMode}
                tagMatch={tagMatch}
                hasActiveFilters={hasActiveFilters}
                tagOptions={visibleTags}
                tagQuery={tagQuery}
                onTagQueryChange={setTagQuery}
                onToggleTag={onToggleTag}
                onSortChange={onSortChange}
                onRatingChange={onRatingChange}
                onNsfwChange={onNsfwChange}
                onTagMatchChange={onTagMatchChange}
                onReset={onReset}
              />
            </div>
            <Button type="button" className="mt-4 w-full shrink-0" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
  tagOptions,
  tagQuery,
  onTagQueryChange,
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
  tagOptions: CharacterTagOption[];
  tagQuery: string;
  onTagQueryChange: (value: string) => void;
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

      <TagFilterSearch value={tagQuery} onChange={onTagQueryChange} />

      <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <div className="flex w-max max-w-full flex-wrap gap-2">
          {tagOptions.map((tag) => (
            <TagButton key={tag.slug} active={selectedTags.includes(tag.slug)} onClick={() => onToggleTag(tag.slug)}>
              {displayTagLabel(tag.slug)}
            </TagButton>
          ))}
        </div>
      </div>

      {tagOptions.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No matching tags.</p> : null}

      {selectedTags.length > 1 ? <TagMatchControl value={tagMatch} onChange={onTagMatchChange} /> : null}

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

function TagFilterSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block max-w-sm">
      <span className="sr-only">Filter tags</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter tags..."
        className="focus-ring h-10 w-full rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      />
    </label>
  );
}

function buildCharacterParams(filters: DiscoveryFilters, take: number) {
  const params = serializeDiscoveryFilters(filters);
  params.set("take", String(take));
  return params;
}

function TagMatchControl({
  value,
  onChange
}: {
  value: DiscoveryTagMatch;
  onChange: (value: DiscoveryTagMatch) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Tag matching</legend>
      <span className="mr-1 text-xs font-semibold text-[var(--text-muted)]">Selected tags:</span>
      <FilterButton active={value === "any"} onClick={() => onChange("any")}>
        Match any
      </FilterButton>
      <FilterButton active={value === "all"} onClick={() => onChange("all")}>
        Match all
      </FilterButton>
    </fieldset>
  );
}

function FilterGroup({
  icon: Icon,
  label,
  children
}: {
  icon: typeof SlidersHorizontal;
  label: string;
  children: React.ReactNode;
}) {
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

function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring min-h-11 rounded-lg border px-3 font-mono text-[10px] font-medium uppercase tracking-[.12em] active:scale-[.98]",
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
      aria-pressed={active}
      className={cn(
        "focus-ring min-h-11 rounded-lg border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[.12em] active:scale-[.98]",
        active
          ? "border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
      style={
        active
          ? undefined
          : {
              background: "color-mix(in oklch, var(--color-surface) 44%, transparent)",
              backdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
              WebkitBackdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))"
            }
      }
    >
      {children}
    </button>
  );
}
