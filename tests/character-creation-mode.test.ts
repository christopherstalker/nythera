import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  creationModeForEditor,
  creationModeForNewCharacter
} from "../src/lib/character-form-payload";

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
