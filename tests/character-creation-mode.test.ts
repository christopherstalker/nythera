import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCharacterCreatePayload,
  creationModeForEditor,
  creationModeForNewCharacter,
  validateCharacterCreatePayload
} from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";
import { normalizeMessageLength, responseLengthTarget, verbosityForMessageLength } from "../src/lib/response-length";

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

test("the character editor renders the stored guided mode instead of forcing the complete manuscript", async () => {
  const form = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");

  assert.match(form, /const isSimpleMode = formMode === "simple"/);
  assert.doesNotMatch(form, /const isSimpleMode = mode === "create"/);
  assert.match(form, /mode === "edit" \? creationModeForEditor\(initialValue\?\.creationMode\) : "simple"/);
  assert.match(form, /const visibleChapters = isSimpleMode \? guidedChapters : studioChapters/);
  assert.doesNotMatch(form, /<StudioChapter\s+id="publishing"\s+number="04"/);
  assert.match(form, /<StudioChapter\s+id="publishing"\s+number="06"/);
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
      humor: 7,
      romanceLevel: 2,
      seriousness: 8,
      initiative: 6,
      roleplayIntensity: 9,
      creationMode: "simple"
    },
    isSimpleMode: true,
    creationMode: "simple"
  });

  assert.equal(payload.personality, "Patient, precise, and quietly defiant when someone tries to rewrite the truth.");
  assert.equal(payload.scenario, "The sealed archive wakes after midnight while the user is trapped inside.");
  assert.equal(payload.creationMode, "simple");
  assert.equal(payload.visibility, "PRIVATE");
  assert.deepEqual(payload.communicationStyle, {
    tone: "cinematic",
    humor: 7,
    romanceLevel: 2,
    seriousness: 8,
    initiative: 6,
    messageLength: "medium",
    roleplayIntensity: 9,
    prologuePov: "second"
  });
});

test("character creation accepts long opening messages", () => {
  const greeting = "A".repeat(12_000);
  const payload = buildCharacterCreatePayload({
    draft: {
      ...emptyCharacterDraft,
      name: "Ari",
      description: "A quiet archivist who protects dangerous memories.",
      personality: "Patient, precise, and quietly defiant when the truth is threatened.",
      greeting
    },
    isSimpleMode: true,
    creationMode: "simple"
  });

  assert.equal(payload.greeting, greeting);
  assert.equal(validateCharacterCreatePayload(payload).success, true);
});

test("response length is normalized and persisted from the shared behavior control", () => {
  const longPayload = buildCharacterCreatePayload({
    draft: {
      ...emptyCharacterDraft,
      name: "Ari",
      description: "An archivist.",
      personality: "Patient.",
      scenario: "A sealed archive.",
      greeting: "The final bell rings.",
      messageLength: "long"
    }
  });

  assert.equal(longPayload.communicationStyle?.messageLength, "long");
  assert.equal(emptyCharacterDraft.messageLength, "medium");
  assert.equal(normalizeMessageLength("invalid"), "medium");
  assert.equal(verbosityForMessageLength("short"), "concise");
  assert.equal(verbosityForMessageLength("long"), "immersive");
  assert.match(responseLengthTarget("concise"), /1-2 compact paragraphs.*60-140 words/);
  assert.match(
    responseLengthTarget("balanced"),
    /3-4 developed paragraphs.*200-300 words.*hard maximum.*fifth paragraph/
  );
  assert.match(responseLengthTarget("immersive"), /4-7 immersive paragraphs.*320-650 words/);
});

test("guided submit saves directly while optional drafting fills only empty fields", async () => {
  const form = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");
  const submit = form.slice(form.indexOf("async function onSubmit"), form.indexOf("const visibleChapters"));

  assert.doesNotMatch(submit, /\/api\/characters\/generate/);
  assert.match(submit, /fetch\(url/);
  assert.match(submit, /finally \{[\s\S]*?setSaving\(false\)/);
  assert.match(form, /title="Personality & scenario"/);
  assert.match(form, /label="Personality"/);
  assert.match(form, /label="Scenario \/ world"/);
  assert.match(form, /Draft empty fields/);
  assert.match(form, /setDraft\(\(current\) => applyGeneratedPreview\(current, preview\)\)/);
  assert.match(form, /<form noValidate onSubmit=\{onSubmit\}/);
  assert.match(form, /id="character-name"[\s\S]*?minLength=\{2\}/);
  assert.match(form, /id="character-description"[\s\S]*?minLength=\{10\}/);
  assert.match(form, /disabled=\{saving\}/);
  assert.doesNotMatch(form, /disabled=\{saving \|\| !canSubmit\}/);
  assert.match(submit, /revealIdentityError\("Enter a character name[\s\S]*?"character-name"\)/);
  assert.match(submit, /revealIdentityError\("Describe the character's core idea[\s\S]*?"character-description"\)/);

  const guidedChapterDefinition = form.slice(
    form.indexOf("const guidedChapters"),
    form.indexOf("export function CharacterForm")
  );

  assert.doesNotMatch(guidedChapterDefinition, /publishing|Bind the volume/);
  assert.doesNotMatch(form, /Bind the volume|Choose how this character enters your library/);
  assert.doesNotMatch(form, /label="Message length"/);
  assert.match(form, /Response length/);
  assert.match(form, /Prologue point of view/);
  assert.match(form, /Second person — narrates to you/);
  assert.match(form, /Third person — describes your persona/);

  const behaviorSliderDefinition = form.slice(
    form.indexOf("const behaviorSliderFields"),
    form.indexOf("const studioChapters")
  );

  assert.match(behaviorSliderDefinition, /field: "humor", label: "Humor"/);
  assert.match(behaviorSliderDefinition, /field: "romanceLevel", label: "Romance"/);
  assert.match(behaviorSliderDefinition, /field: "seriousness", label: "Seriousness"/);
  assert.match(behaviorSliderDefinition, /field: "initiative", label: "Initiative"/);
  assert.match(behaviorSliderDefinition, /field: "roleplayIntensity", label: "Roleplay intensity"/);
});

test("prompt generator controls never submit the parent character form", async () => {
  const generator = await readFile(new URL("../src/components/character/BotGenerator.tsx", import.meta.url), "utf8");

  assert.match(generator, /type="button"[^>]*onClick=\{\(\) => void generate\(\)\}/);
  assert.match(generator, /type="button"[^>]*onClick=\{\(\) => onApply\(preview\)\}/);
  assert.equal(generator.match(/<GlassButton type="button"/g)?.length, 3);
});

test("prompt generation returns a local character draft after provider failover is exhausted", async () => {
  const generator = await readFile(new URL("../src/lib/generation/characterGenerator.ts", import.meta.url), "utf8");

  assert.match(generator, /try \{[\s\S]*callJsonStage/);
  assert.match(generator, /catch \(error\) \{[\s\S]*return localFallback\(concept, input\.fallbackName\)/);
  assert.match(generator, /logSafeError\("Character generation failed after provider failover; using a local draft\."/);
});
