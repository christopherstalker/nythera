import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  discoveryFiltersFromSearchParams,
  normalizeDiscoveryFilters,
  serializeDiscoveryFilters
} from "../src/lib/discovery-query";

test("discovery filters normalize and serialize in a stable order", () => {
  const filters = normalizeDiscoveryFilters({
    query: "  moon knight  ",
    tags: ["romance", "fantasy", "romance"],
    sort: "top-rated",
    ratingMin: 4.5,
    nsfw: "include",
    tagMatch: "all"
  });

  assert.equal(
    serializeDiscoveryFilters(filters).toString(),
    "q=moon+knight&tag=fantasy&tag=romance&sort=top-rated&ratingMin=4.5&nsfw=include&match=all"
  );
  assert.deepEqual(discoveryFiltersFromSearchParams(serializeDiscoveryFilters(filters)), filters);
});

test("discovery filters reject unsupported values and enforce tag limits", () => {
  const filters = normalizeDiscoveryFilters({
    tags: Array.from({ length: 20 }, (_, index) => `tag-${index}`),
    sort: "popular",
    ratingMin: 4.2,
    nsfw: "unsafe"
  });

  assert.equal(filters.tags.length, 8);
  assert.equal(filters.sort, "trending");
  assert.equal(filters.ratingMin, 0);
  assert.equal(filters.nsfw, "safe");
});

test("Explore refreshes on mutations without recurring polling", async () => {
  const source = await readFile(new URL("../src/components/explore/explore-page-client.tsx", import.meta.url), "utf8");

  assert.match(source, /nythera:characters-updated/);
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /cache:\s*"no-store"/);
});
