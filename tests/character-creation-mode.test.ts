import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCharacterCreatePayload,
  creationModeForEditor,
  creationModeForNewCharacter
} from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";

test("new character modes persist the matching data shape", () => {
  assert.equal(creationModeForNewCharacter("simple"), "simple");
  assert.equal(creationModeForNewCharacter("custom"), "custom");
  assert.equal(creationModeForNewCharacter("prompt"), "custom");
});

test("the editor honors stored simple mode and defaults legacy characters to custom", () => {
  assert.equal(creationModeForEditor("simple"), "simple");
  assert.equal(creationModeForEditor("custom"), "custom");
  assert.equal(creationModeForEditor(undefined), "custom");
});

test("creation mode is persisted and legacy database rows default to custom", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const validation = await readFile(new URL("../src/lib/validation.ts", import.meta.url), "utf8");

  assert.match(schema, /creationMode\s+CharacterCreationMode\s+@default\(custom\)/);
  assert.match(validation, /creationMode:\s*z\.enum\(\["simple", "custom"\]\)\.default\("custom"\)/);
});

test("guided creation preserves authored personality and scenario", () => {
  const payload = buildCharacterCreatePayload({
    draft: {
      ...emptyCharacterDraft,
      name: "Ari",
      description: "A quiet archivist who protects dangerous memories.",
      personality: "Patient, precise, and quietly defiant when someone tries to rewrite the truth.",
      scenario: "The sealed archive wakes after midnight while the user is trapped inside.",
      greeting: "You should not be here after the final bell.",
      creationMode: "simple"
    },
    isSimpleMode: true,
    creationMode: "simple"
  });

  assert.equal(payload.personality, "Patient, precise, and quietly defiant when someone tries to rewrite the truth.");
  assert.equal(payload.scenario, "The sealed archive wakes after midnight while the user is trapped inside.");
  assert.equal(payload.creationMode, "simple");
  assert.equal(payload.visibility, "PRIVATE");
});

test("guided submit saves directly while optional drafting fills only empty fields", async () => {
  const form = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");
  const submit = form.slice(form.indexOf("async function onSubmit"), form.indexOf("const visibleChapters"));

  assert.doesNotMatch(submit, /\/api\/characters\/generate/);
  assert.match(submit, /fetch\(url/);
  assert.match(form, /title="Personality & scenario"/);
  assert.match(form, /label="Personality"/);
  assert.match(form, /label="Scenario \/ world"/);
  assert.match(form, /Draft empty fields/);
  assert.match(form, /setDraft\(\(current\) => applyGeneratedPreview\(current, preview\)\)/);
});
