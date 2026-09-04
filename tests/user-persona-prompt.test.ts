import assert from "node:assert/strict";
import test from "node:test";

import type { UserPersona } from "@prisma/client";
import { formatUserPersonaContinuitySource, formatUserPersonaForPrompt } from "../src/lib/user-persona-prompt";

const persona = {
  id: "persona-1",
  userId: "user-1",
  label: "Christopher",
  displayName: "Christopher",
  surname: "Stalker",
  avatarUrl: null,
  summary: [
    "Character Profile: Christopher Stalker",
    "Gender: Male (he/him). Deep, soft bass voice.",
    "Species: Calico cat hybrid (7 ft / ~213 cm, 400 lbs / ~180 kg).",
    "",
    "Physical Appearance:",
    "Physique: Towering, hyper-muscular bodybuilder frame.",
    "Face & Hair: Masculine face, dark purple eyes."
  ].join("\n"),
  background: "Former athlete.",
  traits: ["Patient", "hyper-muscular"],
  likes: [],
  dislikes: [],
  boundaries: ["Use he/him pronouns"],
  isDefault: true,
  visibility: "PRIVATE",
  metadata: {},
  createdAt: new Date(0),
  updatedAt: new Date(0)
} satisfies UserPersona;

test("the model-facing persona contains identity and boundaries without appearance details", () => {
  const formatted = formatUserPersonaForPrompt(persona) ?? "";

  assert.match(formatted, /Canonical player identity: Gender: Male \(he\/him\)\. Species: Calico cat hybrid\./);
  assert.match(formatted, /Canonical player surname: Stalker/);
  assert.match(formatted, /Use he\/him pronouns/);
  assert.doesNotMatch(formatted, /deep, soft bass|213|400|towering|hyper-muscular|dark purple eyes|Former athlete/);
});

test("surname is omitted from the model-facing identity when the persona has none", () => {
  const formatted = formatUserPersonaForPrompt({ ...persona, surname: null }) ?? "";

  assert.doesNotMatch(formatted, /Canonical player surname/);
});

test("private continuity source retains raw facts without making them model-facing persona text", () => {
  const continuity = formatUserPersonaContinuitySource(persona) ?? "";

  assert.match(continuity, /213 cm/);
  assert.match(continuity, /hyper-muscular/);
  assert.match(continuity, /Former athlete/);
});
