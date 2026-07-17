import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Explore uses one bento component for default and filtered discovery results", async () => {
  const explore = await read("../src/app/(main)/explore/page.tsx");

  assert.match(explore, /import \{ CharacterBentoGrid \}/);
  assert.equal((explore.match(/<CharacterBentoGrid/g) ?? []).length, 2);
  assert.match(explore, /<FeaturedStage/);
  assert.match(explore, /codex-discovery-stage/);
  assert.match(explore, /codex-discovery-dock/);
  assert.match(explore, /The living index/);
  assert.match(explore, /layout="shelf"/);
  assert.match(explore, /More filters/);
  assert.doesNotMatch(explore, /data:image\/svg\+xml/);
  assert.doesNotMatch(explore, /<CharacterRow|<CharacterGrid/);
});

test("Explore keeps mobile and tablet filters behind a search-adjacent drawer trigger", async () => {
  const explore = await read("../src/app/(main)/explore/page.tsx");
  const searchBar = await read("../src/components/ui/search-bar.tsx");

  assert.match(searchBar, /onFilterClick/);
  assert.match(searchBar, /aria-expanded=\{filterExpanded\}/);
  assert.match(searchBar, /aria-controls=\{filterControls\}/);
  assert.match(searchBar, /xl:hidden/);
  assert.match(explore, /const \[filtersOpen, setFiltersOpen\] = useState\(false\)/);
  assert.match(explore, /filterControls="explore-filter-drawer"/);
  assert.match(explore, /id="explore-filter-drawer"/);
  assert.match(explore, /hidden gap-5 xl:grid/);
  assert.match(explore, /fixed inset-x-3 bottom-\[calc\(var\(--bottom-nav-offset\)_\+_8px\)\]/);
  assert.match(explore, /md:bottom-6/);
  assert.match(explore, /<DiscoveryFilterControls/);
});

test("Discovery archive provides featured and wide folios with responsive collapse", async () => {
  const [schema, migration, bento, globals] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260628190000_character_discovery_placement/migration.sql"),
    read("../src/components/characters/CharacterBentoGrid.tsx"),
    read("../src/app/globals.css")
  ]);

  assert.match(schema, /discoveryPlacement\s+DiscoveryPlacement\s+@default\(STANDARD\)/);
  assert.match(schema, /enum DiscoveryPlacement/);
  assert.match(migration, /CREATE TYPE "DiscoveryPlacement"/);
  assert.match(migration, /ranked_public_characters/);
  assert.match(bento, /featuredScore/);
  assert.match(bento, /orderedCharacters/);
  assert.match(bento, /count >= 3 && index === 0/);
  assert.match(bento, /count >= 4 && index === 3/);
  assert.match(bento, /layout\?: "bento" \| "shelf"/);
  assert.match(bento, /layout === "bento" && placement === "FEATURED"/);
  assert.match(bento, /codex-character-catalog/);
  assert.match(bento, /codex-character-record/);
  assert.match(bento, /bentoCellClass\(placement\)/);
  assert.match(bento, /nythera-bento-grid/);
  assert.match(bento, /presentation="discovery"/);
  assert.match(globals, /\.codex-character-catalog\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*768px\)[\s\S]*\.codex-character-catalog\s*\{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*1280px\)[\s\S]*\.codex-character-catalog\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(globals, /\.codex-character-record\.nythera-bento-featured[\s\S]*grid-column:\s*span 2;[\s\S]*grid-row:\s*span 2/);
  assert.match(globals, /\.codex-character-record\.nythera-bento-wide[\s\S]*grid-column:\s*span 2/);
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
  assert.doesNotMatch(discovery, /orbital-glass|rounded-\[20px\]/);
});
