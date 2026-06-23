import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Explore uses one bento component for default and filtered discovery results", async () => {
  const explore = await read("../src/app/(main)/explore/page.tsx");

  assert.match(explore, /import \{ CharacterBentoGrid \}/);
  assert.equal((explore.match(/<CharacterBentoGrid/g) ?? []).length, 2);
  assert.doesNotMatch(explore, /<CharacterRow|<CharacterGrid/);
});

test("Discovery bento provides featured and wide desktop spans with responsive collapse", async () => {
  const bento = await read("../src/components/characters/CharacterBentoGrid.tsx");

  assert.match(bento, /characters\.length >= 4/);
  assert.match(bento, /xl:col-span-2 xl:row-span-2/);
  assert.match(bento, /xl:col-span-2/);
  assert.match(bento, /grid-cols-1[\s\S]*sm:grid-cols-2[\s\S]*xl:grid-cols-4/);
  assert.match(bento, /presentation="discovery"/);
});

test("Discovery cards overlay copy and tags on full-bleed artwork", async () => {
  const card = await read("../src/components/characters/CharacterCard.tsx");
  const discoveryStart = card.indexOf('presentation === "discovery"');
  const discoveryEnd = card.indexOf("\n  }\n\n  return (", discoveryStart);
  const discovery = card.slice(discoveryStart, discoveryEnd);

  assert.match(discovery, /absolute inset-0 h-full w-full object-cover/);
  assert.match(discovery, /linear-gradient\(180deg,transparent/);
  assert.match(discovery, /\{character\.name\}/);
  assert.match(discovery, /\{character\.description/);
  assert.match(discovery, /character\.tags\.slice/);
  assert.doesNotMatch(discovery, /h-\[72%\]|rounded-t-/);
});
