import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("library list cards wrap long character names without pushing actions off-screen", async () => {
  const card = await read("../src/components/library/character-roster-card.tsx");

  assert.match(card, /grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
  assert.match(card, /line-clamp-2 min-w-0 break-words/);
  assert.match(card, /flex shrink-0 items-center gap-2/);
  assert.doesNotMatch(card, /<p className="truncate text-sm font-semibold/);
});
