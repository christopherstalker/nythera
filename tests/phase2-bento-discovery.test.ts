import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("the default discovery feed uses a dedicated compact gallery component", async () => {
  const [explore, card, gallery] = await Promise.all([
    read("../src/components/explore/explore-page-client.tsx"),
    read("../src/components/characters/CharacterCard.tsx"),
    read("../src/components/characters/CharacterGallery.tsx")
  ]);

  assert.match(explore, /import \{ CharacterGallery \}/);
  assert.match(explore, /<CharacterGallery/);
  assert.doesNotMatch(explore, /<CharacterRow/);
  assert.match(card, /discoveryPlacement\?: "STANDARD" \| "FEATURED" \| "WIDE"/);
  assert.doesNotMatch(gallery, /nythera-bento-featured|nythera-bento-wide|bentoCellClass/);
  assert.match(gallery, /SkeletonCard/);
  assert.match(gallery, /CharacterCard/);
});

test("gallery stays uniform and increases density across responsive breakpoints", async () => {
  const globals = await read("../src/app/globals.css");

  assert.match(globals, /\.codex-character-gallery\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*768px\)[\s\S]*\.codex-character-gallery\s*\{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*1280px\)[\s\S]*\.codex-character-gallery\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(globals, /\.codex-character-plate-image\s*\{[\s\S]*aspect-ratio:\s*4 \/ 5/);
  assert.doesNotMatch(globals, /nythera-bento-featured|nythera-bento-wide/);
});
