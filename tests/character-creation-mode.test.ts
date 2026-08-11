import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCharacterCreatePayload,
  creationModeForEditor,
  creationModeForNewCharacter
} from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";
import {
  normalizeMessageLength,
  responseLengthTarget,
  verbosityForMessageLength
} from "../src/lib/response-length";

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
    roleplayIntensity: 9
  });
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
  assert.match(responseLengthTarget("immersive"), /4-7 immersive paragraphs.*320-650 words/);
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

  const guidedPublishing = form.slice(
    form.indexOf('id="publishing" number="04"'),
    form.indexOf('id="identity" number="01"', form.indexOf('id="publishing" number="04"'))
  );

  assert.doesNotMatch(guidedPublishing, /Open complete manuscript/);
  assert.doesNotMatch(guidedPublishing, /switchFormMode\("custom"\)/);
  assert.match(guidedPublishing, /<BehaviorControls/);
  assert.match(guidedPublishing, /onMessageLengthChange=\{\(value\) => update\("messageLength", value\)\}/);
  assert.doesNotMatch(form, /label="Message length"/);
  assert.match(form, /Response length/);

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
