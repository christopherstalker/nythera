import assert from "node:assert/strict";
import test from "node:test";
import { characterDisclosure } from "../src/lib/character-provenance";
import { CatalogSourceSchema, recordStatus, reviewScore, type CharacterReview } from "../scripts/character-factory/schema";

const referenceBrief = "A documented public reference brief with enough concrete source material to constrain generation. ".repeat(4);

test("real-person sources require an explicit living-person flag", () => {
  const parsed = CatalogSourceSchema.safeParse({
    id: "public-figure-example",
    name: "Public Figure",
    originType: "REAL_PERSON",
    sourceLabel: "Official public biography",
    sourceUrls: ["https://example.com/biography"],
    referenceBrief
  });

  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues[0]?.message ?? "", /must state whether the subject is living/i);
});

test("fan interpretations require a named universe", () => {
  const parsed = CatalogSourceSchema.safeParse({
    id: "fan-character-example",
    name: "Fan Character",
    originType: "FAN_INTERPRETATION",
    sourceLabel: "Source work",
    sourceUrls: ["https://example.com/source"],
    referenceBrief
  });

  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues[0]?.message ?? "", /must name their universe/i);
});

test("source provenance rejects non-web URL schemes", () => {
  const parsed = CatalogSourceSchema.safeParse({
    id: "unsafe-source-example",
    name: "Unsafe Source",
    originType: "ORIGINAL",
    sourceLabel: "Unsafe source",
    sourceUrls: ["javascript:alert(1)"],
    referenceBrief
  });

  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues[0]?.message ?? "", /must use HTTP or HTTPS/i);
});

test("real-person disclosure cannot be mistaken for an official account", () => {
  const disclosure = characterDisclosure({ originType: "REAL_PERSON", isRealPerson: true });
  assert.equal(disclosure?.label, "Unofficial AI portrayal");
  assert.match(disclosure?.detail ?? "", /not the real person/i);
  assert.match(disclosure?.detail ?? "", /not an official account/i);
});

test("catalog records reach human review only after strong QA scores", () => {
  const strong: CharacterReview = {
    canonicalFidelity: 9,
    voiceSpecificity: 8,
    sceneEngine: 8,
    consistency: 8,
    userAgency: 9,
    antiSlop: 8,
    verdict: "ACCEPT",
    strengths: [],
    requiredFixes: [],
    factualRisks: []
  };
  assert.equal(reviewScore(strong), 50);
  assert.equal(recordStatus(strong), "READY_FOR_HUMAN_REVIEW");

  assert.equal(
    recordStatus({ ...strong, canonicalFidelity: 5, verdict: "REVISE" }),
    "REJECTED"
  );
});
