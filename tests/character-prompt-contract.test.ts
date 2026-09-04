import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalCharacterName,
  canonicalizeCharacterPersona,
  characterTemplateContext,
  findCharacterIdentityConflicts,
  renderCharacterGreeting,
  renderCharacterTemplate,
  renderCharacterTemplateValue,
  renderInitialChatGreeting,
  renderInitialRoomGreeting
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

test("character templates resolve actor, player name, and optional surname commands before provider handoff", () => {
  assert.equal(
    renderCharacterTemplate("{{char}} greets {{user}} {{user_surname}}. {{character}} waits.", {
      characterName: "Toto Wolff",
      userName: "Alex",
      userSurname: "Morgan"
    }),
    "Toto Wolff greets Alex Morgan. Toto Wolff waits."
  );

  assert.equal(
    renderCharacterTemplate("A letter for {{user_surname}}", {
      characterName: "Toto Wolff",
      userName: "Alex"
    }),
    "A letter for "
  );
});

test("character templates resolve commands recursively inside additional personalities and lorebook entries", () => {
  const context = characterTemplateContext("Ari | Archive", [
    "Active player persona: Investigator",
    "Canonical player name: Alex",
    "Canonical player surname: Morgan"
  ].join("\n"));

  assert.deepEqual(renderCharacterTemplateValue({
    additionalCharacters: [{
      name: "Mira",
      personality: "Mira trusts {{user}} {{user_surname}} but challenges {{char}}."
    }],
    lorebook: {
      entries: [{ keywords: ["{{user_surname}} archive"], text: "{{user}} found the sealed record." }]
    }
  }, context), {
    additionalCharacters: [{
      name: "Mira",
      personality: "Mira trusts Alex Morgan but challenges Ari."
    }],
    lorebook: {
      entries: [{ keywords: ["Morgan archive"], text: "Alex found the sealed record." }]
    }
  });
});

test("new and legacy opening messages use the selected player persona", () => {
  const userPersona = "Canonical player name: Alex\nCanonical player surname: Morgan";

  assert.equal(
    renderCharacterGreeting({ name: "Ari", greeting: "Welcome, {{user}} {{user_surname}}." }, userPersona),
    "Welcome, Alex Morgan."
  );
  assert.equal(renderInitialChatGreeting({
    role: "ASSISTANT",
    sequence: 1,
    content: "Welcome, {{user}} {{user_surname}}."
  }, "Ari", userPersona).content, "Welcome, Alex Morgan.");
  assert.equal(renderInitialRoomGreeting({
    role: "CHARACTER",
    sequence: 2,
    content: "Mira recognizes {{user_surname}}."
  }, "Mira", 2, userPersona).content, "Mira recognizes Morgan.");
});

test("template repair never rewrites ordinary conversation messages", () => {
  const message = { role: "USER", sequence: 2, content: "I typed {{user}} literally." };
  assert.equal(renderInitialChatGreeting(message, "Ari", "Canonical player name: Alex"), message);

  const roomMessage = { role: "CHARACTER", sequence: 4, content: "Later {{user}} text." };
  assert.equal(renderInitialRoomGreeting(roomMessage, "Mira", 2, "Canonical player name: Alex"), roomMessage);
});

test("prompt assembly sends one ordered system contract without duplicating the greeting", async () => {
  const source = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");

  assert.match(source, /CHARACTER CONTRACT \(AUTHORITATIVE\)/);
  assert.match(source, /DATA CONSISTENCY GUARD/);
  assert.match(source, /The greeting already exists as the first assistant message/);
  assert.doesNotMatch(source, /Canonical greeting:/);
  assert.match(source, /const system = \[/);
  assert.match(source, /\{ role: "system", content: system \}/);
  assert.match(source, /renderCharacterTemplateValue\(persona, context\)/);
  assert.match(source, /renderCharacterTemplateValue\(character\.lorebook/);
});

test("all chat creation paths render the opening message before persistence", async () => {
  const [web, mobile, rooms] = await Promise.all([
    readFile(new URL("../src/app/api/chats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/chats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/rooms.ts", import.meta.url), "utf8")
  ]);

  assert.match(web, /content: greeting/);
  assert.match(mobile, /content: greeting/);
  assert.match(rooms, /content: renderCharacterPrologue\(\{\s*greeting: renderCharacterGreeting\(character, userPersona\)/);
  assert.doesNotMatch(web, /content: character\.greeting/);
  assert.doesNotMatch(mobile, /content: character\.greeting/);
  assert.doesNotMatch(rooms, /content: character\.greeting/);
});
