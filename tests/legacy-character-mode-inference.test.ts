import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { generateSimpleCharacterDraft } from "../src/lib/simple-character-generation";

test("legacy characters with the deterministic Simple shape are inferred as simple", async () => {
  const creationMode = await import("../src/lib/character-creation-mode").catch(() => null);
  assert.ok(creationMode, "legacy character creation-mode inference is missing");

  const description = "A reserved adventurer with a dry sense of humor.";
  const generated = generateSimpleCharacterDraft({ name: "Ryan", description });

  assert.equal(
    creationMode.inferLegacyCharacterCreationMode({
      name: "Ryan",
      description,
      personality: generated.personality,
      scenario: generated.scenario,
      persona: { archetype: generated.archetype }
    }),
    "simple"
  );
});

test("legacy characters with a custom-shaped scenario remain custom", async () => {
  const creationMode = await import("../src/lib/character-creation-mode").catch(() => null);
  assert.ok(creationMode, "legacy character creation-mode inference is missing");

  const description = "A reserved adventurer with a dry sense of humor.";
  const generated = generateSimpleCharacterDraft({ name: "Ryan", description });

  assert.equal(
    creationMode.inferLegacyCharacterCreationMode({
      name: "Ryan",
      description,
      personality: generated.personality,
      scenario: "A deliberately authored custom world.",
      persona: { archetype: generated.archetype }
    }),
    "custom"
  );
});

test("the data migration backfills only pre-persistence records with the Simple signature", async () => {
  const migration = await readFile(
    new URL("../prisma/migrations/20260620183000_infer_legacy_simple_characters/migration.sql", import.meta.url),
    "utf8"
  ).catch(() => "");

  assert.match(migration, /SET "creationMode" = 'simple'/);
  assert.match(migration, /"createdAt" < TIMESTAMPTZ '2026-06-20T15:10:00\.000Z'/);
  assert.match(migration, /"scenario" =/);
  assert.match(migration, /user-created persona/);
});
