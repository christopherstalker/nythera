import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  mergeCharacterTagOptions,
  normalizeCharacterTag
} from "../src/lib/character-tags";

test("custom tags normalize once and saved choices take precedence", () => {
  assert.equal(normalizeCharacterTag("  Space  Pirates  "), "space-pirates");

  const tags = mergeCharacterTagOptions(
    [{ slug: "space-pirates", label: "Space Pirates", source: "saved", usageCount: 3 }],
    [{ slug: "Space Pirates", label: "Space pirates", source: "popular", usageCount: 20 }]
  );

  assert.deepEqual(tags, [
    { slug: "space-pirates", label: "Space Pirates", source: "saved", usageCount: 3 }
  ]);
});

test("character mutations persist tags in a cross-device user library", async () => {
  const [schema, migration, mutations, route, input, styles] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260824203000_user_tag_library/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/character-mutations.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/tags/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/characters/tag-chip-input.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(schema, /model UserTag/);
  assert.match(schema, /@@unique\(\[userId, slug\]\)/);
  assert.match(migration, /INSERT INTO "UserTag"/);
  assert.match(mutations, /rememberUserTags\(transaction/);
  assert.match(route, /getUserTagOptions/);
  assert.match(route, /private, no-store/);
  assert.match(input, /Saved tags/);
  assert.match(input, /Search or create a tag/);
  assert.match(input, /className="codex-tag-search-input w-full"/);
  assert.match(styles, /padding-left:\s*var\(--codex-field-padding-left, 0\);/);
  assert.match(styles, /padding-right:\s*var\(--codex-field-padding-right, 0\);/);
  assert.match(styles, /\.codex-manuscript \.codex-tag-search-input\s*\{[\s\S]*?--codex-field-padding-left:\s*2\.5rem;[\s\S]*?--codex-field-padding-right:\s*\.75rem;/);
});
