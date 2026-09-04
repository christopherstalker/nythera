import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Explore uses one compact gallery component for default and filtered discovery results", async () => {
  const explore = await read("../src/components/explore/explore-page-client.tsx");

  assert.match(explore, /import \{ CharacterGallery \}/);
  assert.equal((explore.match(/<CharacterGallery/g) ?? []).length, 2);
  assert.doesNotMatch(explore, /<FeaturedStage|codex-discovery-stage/);
  assert.match(explore, /codex-discovery-dock/);
  assert.match(explore, /The living index/);
  assert.match(explore, /slice\(0, FEED_TAKE\)/);
  assert.match(explore, /More filters/);
  assert.doesNotMatch(explore, /data:image\/svg\+xml/);
  assert.doesNotMatch(explore, /<CharacterRow|<CharacterGrid/);
});

test("Explore keeps mobile and tablet filters behind a search-adjacent drawer trigger", async () => {
  const explore = await read("../src/components/explore/explore-page-client.tsx");
  const searchBar = await read("../src/components/ui/search-bar.tsx");

  assert.match(searchBar, /onFilterClick/);
  assert.match(searchBar, /aria-expanded=\{filterExpanded\}/);
  assert.match(searchBar, /aria-controls=\{filterControls\}/);
  assert.match(searchBar, /xl:hidden/);
  assert.match(explore, /const \[filtersOpen, setFiltersOpen\] = useState\(false\)/);
  assert.match(explore, /filterControls="explore-filter-drawer"/);
  assert.match(explore, /id="explore-filter-drawer"/);
  assert.match(explore, /hidden gap-5[^"\n]*xl:grid/);
  assert.match(explore, /fixed inset-x-3 bottom-\[calc\(var\(--bottom-nav-offset\)_\+_8px\)\]/);
  assert.match(explore, /md:bottom-6/);
  assert.match(explore, /<DiscoveryFilterControls/);
});

test("Discovery keeps placement ranking while rendering a uniform responsive gallery", async () => {
  const [schema, migration, gallery, globals] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260628190000_character_discovery_placement/migration.sql"),
    read("../src/components/characters/CharacterGallery.tsx"),
    read("../src/app/globals.css")
  ]);

  assert.match(schema, /discoveryPlacement\s+DiscoveryPlacement\s+@default\(STANDARD\)/);
  assert.match(schema, /enum DiscoveryPlacement/);
  assert.match(migration, /CREATE TYPE "DiscoveryPlacement"/);
  assert.match(migration, /ranked_public_characters/);
  assert.match(gallery, /featuredScore/);
  assert.match(gallery, /orderedCharacters/);
  assert.match(gallery, /character\.discoveryPlacement === "FEATURED"/);
  assert.match(gallery, /codex-character-gallery/);
  assert.match(gallery, /codex-character-tile/);
  assert.match(gallery, /presentation="discovery"/);
  assert.match(globals, /\.codex-character-gallery\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*768px\)[\s\S]*\.codex-character-gallery\s*\{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*1280px\)[\s\S]*\.codex-character-gallery\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(globals, /nythera-bento-featured|nythera-bento-wide/);
});

test("Discovery records separate portrait plates from archival copy", async () => {
  const card = await read("../src/components/characters/CharacterCard.tsx");
  const discoveryStart = card.indexOf('presentation === "discovery"');
  const discoveryEnd = card.indexOf("\n  }\n\n  return (", discoveryStart);
  const discovery = card.slice(discoveryStart, discoveryEnd);

  assert.match(discovery, /codex-character-plate-image/);
  assert.match(discovery, /codex-character-plate-copy/);
  assert.match(discovery, /codex-character-plate-veil/);
  assert.doesNotMatch(discovery, /backdropFilter/);
  assert.match(discovery, /\{character\.name\}/);
  assert.match(discovery, /\{character\.description/);
  assert.match(discovery, /character\.tags\?\.slice/);
  assert.match(discovery, /Featured/);
  assert.doesNotMatch(discovery, /orbital-glass|rounded-\[20px\]/);
});
