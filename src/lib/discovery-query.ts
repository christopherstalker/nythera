import { normalizeCharacterTags } from "@/lib/character-tags";

export const DISCOVERY_RATINGS = [0, 3, 4, 4.5] as const;
export const MAX_DISCOVERY_QUERY_LENGTH = 120;
export const MAX_DISCOVERY_FILTER_TAGS = 8;

export type DiscoverySort = "trending" | "top-rated" | "new";
export type DiscoveryNsfwMode = "safe" | "include" | "only";
export type DiscoveryTagMatch = "any" | "all";

export type DiscoveryFilters = {
  query: string;
  tags: string[];
  sort: DiscoverySort;
  ratingMin: number;
  nsfw: DiscoveryNsfwMode;
  tagMatch: DiscoveryTagMatch;
};

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  query: "",
  tags: [],
  sort: "trending",
  ratingMin: 0,
  nsfw: "safe",
  tagMatch: "any"
};

type DiscoveryFilterInput = {
  query?: string | null;
  tags?: string[];
  sort?: string | null;
  ratingMin?: number | string | null;
  nsfw?: string | null;
  tagMatch?: string | null;
};

export function normalizeDiscoveryFilters(input: DiscoveryFilterInput): DiscoveryFilters {
  const rating = Number(input.ratingMin ?? 0);

  return {
    query: (input.query ?? "").trim().slice(0, MAX_DISCOVERY_QUERY_LENGTH),
    tags: normalizeCharacterTags(input.tags ?? []).slice(0, MAX_DISCOVERY_FILTER_TAGS).sort(),
    sort: normalizeDiscoverySort(input.sort),
    ratingMin: DISCOVERY_RATINGS.includes(rating as (typeof DISCOVERY_RATINGS)[number]) ? rating : 0,
    nsfw: normalizeDiscoveryNsfwMode(input.nsfw),
    tagMatch: input.tagMatch === "all" ? "all" : "any"
  };
}

export function discoveryFiltersFromSearchParams(searchParams: URLSearchParams): DiscoveryFilters {
  return normalizeDiscoveryFilters({
    query: searchParams.get("q"),
    tags: searchParams.getAll("tag"),
    sort: searchParams.get("sort"),
    ratingMin: searchParams.get("ratingMin"),
    nsfw: searchParams.get("nsfw"),
    tagMatch: searchParams.get("match")
  });
}

export function serializeDiscoveryFilters(filters: DiscoveryFilters) {
  const normalized = normalizeDiscoveryFilters(filters);
  const searchParams = new URLSearchParams();

  if (normalized.query) searchParams.set("q", normalized.query);
  normalized.tags.forEach((tag) => searchParams.append("tag", tag));
  if (normalized.sort !== DEFAULT_DISCOVERY_FILTERS.sort) searchParams.set("sort", normalized.sort);
  if (normalized.ratingMin > 0) searchParams.set("ratingMin", String(normalized.ratingMin));
  if (normalized.nsfw !== DEFAULT_DISCOVERY_FILTERS.nsfw) searchParams.set("nsfw", normalized.nsfw);
  if (normalized.tags.length > 1 && normalized.tagMatch === "all") searchParams.set("match", "all");

  return searchParams;
}

export function hasDiscoveryFilters(filters: DiscoveryFilters) {
  return Boolean(
    filters.query ||
    filters.tags.length ||
    filters.sort !== DEFAULT_DISCOVERY_FILTERS.sort ||
    filters.ratingMin > 0 ||
    filters.nsfw !== DEFAULT_DISCOVERY_FILTERS.nsfw
  );
}

function normalizeDiscoverySort(value?: string | null): DiscoverySort {
  return value === "new" || value === "top-rated" ? value : "trending";
}

function normalizeDiscoveryNsfwMode(value?: string | null): DiscoveryNsfwMode {
  return value === "include" || value === "only" ? value : "safe";
}
