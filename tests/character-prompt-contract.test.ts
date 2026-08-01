import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalCharacterName,
  canonicalizeCharacterPersona,
  findCharacterIdentityConflicts,
  renderCharacterTemplate
} from "../src/lib/character-prompt-contract";

test("character identity compiler catches Toto-style contradictory source fields", () => {
  const character = {
    name: "Toto Wolff | Pick-me F1",
    personality: "Personality: Isabella\nCalculating and ambitious.",
    scenario: "The chat opens in a flexible scene built around Isabella | F1's central premise.",
    persona: {
      name: "Toto Wolff | Pick-me F1",
      role: "An influential friend"
    }
  };

  assert.equal(canonicalCharacterName(character.name), "Toto Wolff");
  assert.deepEqual(
    findCharacterIdentityConflicts(character).map((issue) => issue.source),
    ["personality heading", "scenario subject"]
  );
  assert.deepEqual(canonicalizeCharacterPersona(character.name, character.persona), {
    name: "Toto Wolff",
    role: "An influential friend"
  });
});

test("character templates resolve explicit actor and user placeholders before provider handoff", () => {
  assert.equal(
    renderCharacterTemplate("{{char}} watches {{user}} enter. {{character}} waits.", {
      characterName: "Toto Wolff",
      userName: "Alex"
    }),
    "Toto Wolff watches Alex enter. Toto Wolff waits."
  );
});

test("prompt assembly sends one ordered system contract without duplicating the greeting", async () => {
  const source = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");

  assert.match(source, /CHARACTER CONTRACT \(AUTHORITATIVE\)/);
  assert.match(source, /DATA CONSISTENCY GUARD/);
  assert.match(source, /The greeting already exists as the first assistant message/);
  assert.doesNotMatch(source, /Canonical greeting:/);
  assert.match(source, /const system = \[/);
  assert.match(source, /\{ role: "system", content: system \}/);
});
