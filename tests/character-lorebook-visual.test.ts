import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseLorebookText } from "../src/lib/character-form-payload";
import { matchLorebookEntries } from "../src/lib/lorebook";
import { characterCreateSchema } from "../src/lib/validation";

test("character lorebook and visual identity are first-class persisted fields", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = await readFile(new URL("../prisma/migrations/20260629101000_character_lorebook_visual_identity/migration.sql", import.meta.url), "utf8");
  const mutations = await readFile(new URL("../src/lib/character-mutations.ts", import.meta.url), "utf8");
  const prompt = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");
  const form = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");
  const formTypes = await readFile(new URL("../src/lib/character-form-types.ts", import.meta.url), "utf8");

  assert.match(schema, /lorebook\s+Json\?/);
  assert.match(schema, /visualIdentity\s+Json\?/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "lorebook" JSONB/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "visualIdentity" JSONB/);

  assert.match(mutations, /lorebook/);
  assert.match(mutations, /visualIdentity/);

  assert.match(prompt, /CHARACTER LOREBOOK \(KEYWORD MATCHED\)/);
  assert.match(prompt, /matchLorebookEntries/);
  assert.match(form, /Character Card V2/);
  assert.match(form, /Export Card V2/);
  assert.match(form, /Keyword lorebook/);
  assert.match(formTypes, /Visual Identity/);
});

test("lorebook preview reports the exact keywords that activate canonical facts", () => {
  const lorebook = parseLorebookText("silver gate, moon gate => Opens only under a full moon.\n\nArchivist oath => Never destroy true records.");
  const matches = matchLorebookEntries(lorebook, ["We finally reached the Silver Gate."]);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0]?.matchedKeywords, ["silver gate"]);
  assert.equal(matches[0]?.text, "Opens only under a full moon.");
});

test("lorebook text parser and validation keep keyword-triggered entries structured", () => {
  const lorebook = parseLorebookText("silver gate, moon gate => Opens only under a full moon.\n\nArchivist oath => Never destroy true records.");

  assert.deepEqual(lorebook.entries[0]?.keywords, ["silver gate", "moon gate"]);
  assert.equal(lorebook.entries[1]?.text, "Never destroy true records.");

  const result = characterCreateSchema.safeParse({
    creationMode: "custom",
    name: "Ari",
    avatarUrl: "",
    description: "A lore-heavy archivist with a precise memory.",
    personality: "A patient archivist who protects continuity and canonical facts.",
    scenario: "A moonlit archive beneath the old city.",
    greeting: "Welcome back to the archive.",
    tags: ["fantasy"],
    visibility: "PRIVATE",
    isNSFW: false,
    lorebook,
    visualIdentity: {
      accentColor: "#8F81F7",
      gradientFrom: "#8F81F7",
      gradientTo: "#6FE7D2",
      chatBackground: "moonlit archive"
    }
  });

  assert.equal(result.success, true);
});
