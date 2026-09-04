import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNarrationOutputGuardLayer,
  createPlayerMeasurementRedactor
} from "../src/lib/narrative-output-guard";

const persona = [
  "Species: Calico cat hybrid (7 ft / ~213 cm, 400 lbs / ~180 kg).",
  "Physique: Towering, hyper-muscular bodybuilder frame."
].join("\n");

test("assistant history redacts numeric and written versions of player measurements", () => {
  const redactor = createPlayerMeasurementRedactor(persona);
  const redacted = redactor.redactAssistant(
    [
      "Jane opens the back-room door.",
      "They notice your 213 cm frame, your two-hundred-and-thirteen-centimeter height, and your four-hundred-pound build.",
      "The dealer pushes a fresh stack of chips across the table."
    ].join("\n\n")
  );

  assert.match(redacted, /Jane opens the back-room door\./);
  assert.match(redacted, /dealer pushes a fresh stack of chips/);
  assert.doesNotMatch(redacted, /213\s*cm/i);
  assert.doesNotMatch(redacted, /two-hundred-and-thirteen-centimeter/i);
  assert.doesNotMatch(redacted, /four-hundred-pound/i);
  assert.doesNotMatch(redacted, /omitted from narrative context/i);
});

test("summary redaction changes assistant prose without rewriting the player's own words", () => {
  const redactor = createPlayerMeasurementRedactor(persona);
  const summary = [
    "Conversation summary:",
    "USER: I am 213 cm tall.",
    "ASSISTANT: Everyone stared at the two-hundred-and-thirteen-centimeter frame."
  ].join("\n");
  const redacted = redactor.redactSummary(summary) ?? "";

  assert.match(redacted, /USER: I am 213 cm tall\./);
  assert.doesNotMatch(redacted, /ASSISTANT:/i);
  assert.doesNotMatch(redacted, /omitted from narrative context/i);
});

test("legacy redaction markers are removed with their contaminated paragraph", () => {
  const redactor = createPlayerMeasurementRedactor(persona);
  const redacted = redactor.redactAssistant(
    "The door opens.\n\nYour [exact player measurement omitted from narrative context] frame fills the threshold."
  );

  assert.equal(redacted, "The door opens.");
});

test("assistant history drops persona recitals coupled to exaggerated reactions", () => {
  const redactor = createPlayerMeasurementRedactor([
    "Gender: Male (he/him). Deep, soft bass voice.",
    persona,
    "Face & Hair: Masculine face, dark purple eyes."
  ].join("\n"));
  const redacted = redactor.redactAssistant([
    "Hayes slides the folder across the table.",
    "Your deep, soft bass makes the men shrink back as they stare from your towering, hyper-muscular frame to your dark purple eyes.",
    "The unsigned contract remains between you."
  ].join("\n\n"));

  assert.match(redacted, /Hayes slides the folder/);
  assert.match(redacted, /unsigned contract remains/);
  assert.doesNotMatch(redacted, /deep, soft bass|hyper-muscular|dark purple eyes/);
});

test("the final narration guard rejects persona recital and contaminated-history imitation", () => {
  const guard = buildNarrationOutputGuardLayer();

  assert.match(guard, /FINAL AUTHORITATIVE CHECK/);
  assert.match(guard, /private internal geometry/);
  assert.match(guard, /numbers written out as words/);
  assert.match(guard, /Previous assistant messages and conversation summaries establish events only/);
  assert.match(guard, /not style examples/);
  assert.match(guard, /validate the direction against Physical Continuity/);
  assert.match(guard, /use neutral gaze language/);
  assert.match(guard, /without measurements, an inventory of traits, or spectacle/);
});
