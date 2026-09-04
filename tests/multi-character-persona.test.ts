import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildCharacterCreatePayload, normalizeInitialCharacterValue } from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";
import { canonicalizeCharacterPersona } from "../src/lib/character-prompt-contract";
import { characterCreateSchema } from "../src/lib/validation";

const additionalCharacter = {
  id: "cast-mira",
  name: "Mira",
  personality: "Sharp-eyed and patient, with a dry sense of humor. She speaks in short, precise sentences and stays guarded but quietly protective."
};

test("character form persists each additional hero as a full personality", () => {
  const payload = buildCharacterCreatePayload({
    draft: {
      ...emptyCharacterDraft,
      name: "Ari",
      description: "An archivist investigating a forbidden collection.",
      personality: "Observant, principled, and difficult to intimidate.",
      greeting: "Ari closes the ledger as the archive door opens.",
      additionalCharacters: [additionalCharacter]
    }
  });

  assert.equal(characterCreateSchema.safeParse(payload).success, true);
  assert.deepEqual((payload.persona as { additionalCharacters: unknown }).additionalCharacters, [{
    id: "cast-mira",
    name: "Mira",
    personality: "Sharp-eyed and patient, with a dry sense of humor. She speaks in short, precise sentences and stays guarded but quietly protective."
  }]);
});

test("existing additional personalities hydrate back into editable character drafts", () => {
  const draft = normalizeInitialCharacterValue({
    persona: {
      additionalCharacters: [{
        id: "cast-mira",
        name: "Mira",
        personality: "Sharp-eyed and patient. She speaks in short, precise sentences and stays guarded."
      }]
    }
  });

  assert.deepEqual(draft.additionalCharacters, [{
    id: "cast-mira",
    name: "Mira",
    personality: "Sharp-eyed and patient. She speaks in short, precise sentences and stays guarded."
  }]);
});

test("legacy split character details are preserved as one editable personality", () => {
  const draft = normalizeInitialCharacterValue({
    persona: {
      additionalCharacters: [{
        name: "Mira",
        role: "Rival investigator",
        personalityTraits: ["Sharp-eyed", "Patient"],
        speakingStyle: "Short, precise sentences.",
        emotionalTone: "Guarded"
      }]
    }
  });

  assert.equal(draft.additionalCharacters[0]?.personality, [
    "Role: Rival investigator",
    "Sharp-eyed\nPatient",
    "Speaking style: Short, precise sentences.",
    "Emotional tone: Guarded"
  ].join("\n\n"));
});

test("canonicalizing the primary actor preserves additional cast identities", () => {
  assert.deepEqual(canonicalizeCharacterPersona("Ari | Archive", {
    name: "Old title",
    additionalCharacters: [{ name: "Mira", role: "Rival investigator" }]
  }), {
    name: "Ari",
    additionalCharacters: [{ name: "Mira", role: "Rival investigator" }]
  });
});

test("prompt assembly compiles an authoritative multi-character cast", async () => {
  const [personaSource, assemblySource] = await Promise.all([
    readFile(new URL("../src/lib/persona.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8")
  ]);

  assert.match(personaSource, /CHARACTER CAST — AUTHORITATIVE IDENTITIES/);
  assert.match(personaSource, /Never merge cast members into one personality/);
  assert.match(personaSource, /Detailed personality and behavior/);
  assert.match(assemblySource, /resolveCharacterCast/);
  assert.match(assemblySource, /formatCharacterCastBlock/);
  assert.match(assemblySource, /renderCharacterTemplateValue\(persona, context\)/);
});

test("the form places additional personalities directly after the primary personality", async () => {
  const formSource = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");
  const personalityField = formSource.indexOf('<Field label="Personality" hint="Optional.');
  const editor = formSource.indexOf("<AdditionalPersonalitiesEditor", personalityField);
  const backgroundField = formSource.indexOf('<Field label="Background">', personalityField);

  assert.ok(personalityField >= 0);
  assert.ok(editor > personalityField);
  assert.ok(backgroundField > editor);
  assert.doesNotMatch(formSource, /Character cast/);
});
