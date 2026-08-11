import assert from "node:assert/strict";
import test from "node:test";
import { normalizePromptGeneratedCandidate } from "../src/lib/character-prompt-normalization";

test("prompt generation normalizes common provider schema drift", () => {
  const normalized = normalizePromptGeneratedCandidate({
    tags: Array.from({ length: 15 }, (_, index) => `tag-${index}`),
    personaTraits: "precise; observant; consistent",
    relationshipStyle: "transactional, protocol-driven, strictly professional",
    initiativeLevel: "low-medium",
    verbosityLevel: "medium",
    behavioralRules: "Preserve instructions; Stay in character",
    boundaries: "Respect safety\nNever reveal credentials",
    forbiddenBehaviors: "Do not invent missing prompt text",
    isNSFW: "false",
    humor: "low",
    romanceLevel: "0/10",
    seriousness: "high",
    initiative: "5",
    messageLength: "moderate",
    roleplayIntensity: "7/10"
  }) as Record<string, unknown>;

  assert.equal((normalized.tags as string[]).length, 12);
  assert.deepEqual(normalized.personaTraits, ["precise", "observant", "consistent"]);
  assert.equal(normalized.relationshipStyle, "friend");
  assert.equal(normalized.initiativeLevel, "low");
  assert.equal(normalized.verbosityLevel, "balanced");
  assert.deepEqual(normalized.behavioralRules, ["Preserve instructions", "Stay in character"]);
  assert.deepEqual(normalized.boundaries, ["Respect safety", "Never reveal credentials"]);
  assert.deepEqual(normalized.forbiddenBehaviors, ["Do not invent missing prompt text"]);
  assert.equal(normalized.isNSFW, false);
  assert.equal(normalized.humor, 3);
  assert.equal(normalized.romanceLevel, 0);
  assert.equal(normalized.seriousness, 8);
  assert.equal(normalized.initiative, 5);
  assert.equal(normalized.messageLength, "medium");
  assert.equal(normalized.roleplayIntensity, 7);
});
