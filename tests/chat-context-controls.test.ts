import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPhysicalContinuityLayer,
  createPhysicalContinuityOutputGuard,
  extractPlayerPhysicalCanon,
  formatPlayerPhysicalCanon
} from "../src/lib/physical-continuity";
import {
  configuredOutputTokenLimit,
  maxOutputTokensForVerbosity,
  providerOutputTokenBudget,
  resolveChatOutputTokenLimit,
  responseLengthTarget
} from "../src/lib/response-length";
import { romanceLevelInstruction } from "../src/lib/romance-level";
import { resolveVariantSelection, selectPersistedConversationBranch } from "../src/lib/message-actions";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("the persisted third regeneration remains selected after four attempts", () => {
  assert.equal(resolveVariantSelection(undefined, undefined, 4, 2), 2);

  const conversation = [
    { id: "u1", role: "USER" as const, content: "Choose." },
    ...[1, 2, 3, 4].map((version) => ({
      id: `a${version}`,
      role: "ASSISTANT" as const,
      content: `Version ${version}`
    })),
    {
      id: "u2",
      role: "USER" as const,
      content: "Continue with that.",
      clientRequestId: "request-2",
      branchSourceMessageId: "a3"
    }
  ];

  assert.deepEqual(
    selectPersistedConversationBranch(conversation).map((message) => message.id),
    ["u1", "a3", "u2"]
  );
});

test("response sizes have hard prompt ranges and matching provider caps", () => {
  assert.match(responseLengthTarget("concise"), /stay within 60-140 words/);
  assert.match(responseLengthTarget("balanced"), /3-4 developed paragraphs.*200-300 words.*hard maximum.*fifth paragraph/);
  assert.match(responseLengthTarget("immersive"), /stay within 320-650 words/);
  assert.equal(maxOutputTokensForVerbosity("concise"), 240);
  assert.equal(maxOutputTokensForVerbosity("balanced"), 480);
  assert.equal(maxOutputTokensForVerbosity("immersive"), 1_050);
  assert.equal(maxOutputTokensForVerbosity("immersive", 700), 700);
  assert.equal(configuredOutputTokenLimit(null, null), null);
  assert.equal(configuredOutputTokenLimit(1_200, 2_048), 1_200);
  assert.equal(configuredOutputTokenLimit(null, 2_048), 2_048);
  assert.equal(resolveChatOutputTokenLimit("concise", null, null), 240);
  assert.equal(resolveChatOutputTokenLimit("concise", null, 2_048), 2_048);
  assert.equal(resolveChatOutputTokenLimit("immersive", 700, 2_048), 700);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 520, provider: "openai", model: "gpt-5" }), 520);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 520, provider: "gemini", model: "gemini-2.5-flash" }), 2_056);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 1_050, provider: "gemini", model: "gemini-3.6-flash" }), 2_586);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 520, provider: "gemini", model: "failover-proof:failover-model" }), 2_056);
});

test("explicit character and player heights become private semantic spatial constraints", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Marek",
      description: "Marek is 178 cm tall.",
      personality: "Reserved and observant.",
      scenario: null
    },
    "Active user persona: Rowan\nUser persona summary: Rowan is 213 cm tall."
  );

  assert.match(layer ?? "", /Canonical character height \(Marek\): 178 cm/);
  assert.match(layer ?? "", /Canonical player height: 213 cm/);
  assert.match(layer ?? "", /player is 35 cm taller than Marek/);
  assert.match(layer ?? "", /Marek must look up to meet the player's eyes/);
  assert.match(layer ?? "", /Forbidden.*Marek looking down at/);
  assert.match(layer ?? "", /no player-authored seated, kneeling, crouched, or lying pose is established/);
});

test("Russian height labels beat unrelated body measurements", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Ирина",
      description: "Параметры: 90 см. Рост Ирины — 175 см.",
      personality: "Спокойная.",
      scenario: null
    },
    "Параметры тела: 100 см. Рост пользователя: 195 см."
  );

  assert.match(layer ?? "", /Canonical character height \(Ирина\): 175 cm/);
  assert.match(layer ?? "", /Canonical player height: 195 cm/);
  assert.match(layer ?? "", /player is 20 cm taller than Ирина/);
});

test("the latest player-authored posture overrides stale seating narration", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Marek",
      description: "Marek is 178 cm tall.",
      personality: "Reserved.",
      scenario: null
    },
    "User persona summary: 195 cm tall.",
    {
      recentMessages: [
        { role: "USER", content: "I sit in the chair." },
        { role: "ASSISTANT", content: "Marek looks down at you." },
        { role: "USER", content: "I stand back up." }
      ],
      currentMessage: "I am not sitting now."
    }
  );

  assert.match(layer ?? "", /CURRENT PLAYER POSTURE: upright\/standing/);
  assert.match(layer ?? "", /Apply the computed standing relation now/);
});

test("imperial heights are normalized before deriving the standing eye line", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Noah",
      description: "Noah's height is 5 ft 10 in.",
      personality: "Reserved and observant.",
      scenario: null
    },
    "User persona summary: Height: 6'4\"."
  );

  assert.match(layer ?? "", /Canonical character height \(Noah\): 178 cm/);
  assert.match(layer ?? "", /Canonical player height: 193 cm/);
  assert.match(layer ?? "", /player is 15 cm taller than Noah/);
});

test("near-equal heights produce a level eye line instead of arbitrary dominance", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Ari",
      description: "Ari is 180 cm tall.",
      personality: "Direct.",
      scenario: null
    },
    "User persona summary: 182 cm tall."
  );

  assert.match(layer ?? "", /approximately the same height/);
  assert.match(layer ?? "", /describe their eye line as level/);
});

test("player weight and handling constraints remain authoritative physical canon", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Adrian",
      description: "Adrian is 188 cm tall and weighs 82 kg.",
      personality: "Controlled.",
      scenario: null
    },
    "User persona summary: I am 213 cm tall and weigh 145 kg. I cannot be lifted or carried by another person."
  );

  assert.match(layer ?? "", /Canonical player weight: 145 kg/);
  assert.match(layer ?? "", /player is 63 kg heavier than Adrian/);
  assert.match(layer ?? "", /Adrian cannot lift, carry, hoist, drag, or reposition/);
  assert.match(layer ?? "", /gender stereotype cannot override this fact/);
});

test("persistent player canon survives trimmed history and stale API context", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Adrian",
      description: "Adrian is 185 cm tall and weighs 78 kg.",
      personality: "Controlled.",
      scenario: null
    },
    "User persona summary: A veteran navigator.",
    {
      recentMessages: [{ role: "ASSISTANT", content: "Adrian checks the route." }],
      currentMessage: "Continue.",
      persistentPlayerContext: [
        "Conversation summary:",
        "[CANONICAL PLAYER PHYSICAL FACTS]",
        "- Height: 205 cm.",
        "- Weight: 132 kg.",
        "- Handling constraint: the player cannot be lifted or carried by another character.",
        "ASSISTANT: You are only 160 cm tall and weigh 50 kg, so Adrian picks you up."
      ].join("\n")
    }
  );

  assert.match(layer ?? "", /Canonical player height: 205 cm/);
  assert.match(layer ?? "", /Canonical player weight: 132 kg/);
  assert.match(layer ?? "", /CANONICAL HANDLING CONSTRAINT/);
});

test("Russian qualitative size facts become physical constraints without measurements", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Илья",
      description: "Илья действует уверенно.",
      personality: "Упрямый.",
      scenario: null
    },
    "Мой рост больше, я выше него. Мой вес больше, я тяжелее. Меня нельзя поднять."
  );

  assert.match(layer ?? "", /player is taller than Илья/);
  assert.match(layer ?? "", /player is heavier than Илья/);
  assert.match(layer ?? "", /Илья cannot lift/);
});

test("external prompts receive physical facts without built-in handling behavior", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Adrian",
      description: "Adrian weighs 80 kg.",
      personality: "Controlled.",
      scenario: null
    },
    "I weigh 140 kg and cannot be lifted.",
    { recentMessages: [], currentMessage: "Continue.", factsOnly: true }
  );

  assert.match(layer ?? "", /PHYSICAL CONTINUITY \(FACTUAL CONTEXT\)/);
  assert.match(layer ?? "", /Canonical player weight: 140 kg/);
  assert.match(layer ?? "", /Canonical handling constraint/);
  assert.doesNotMatch(layer ?? "", /gender stereotype|Require established strength|HIGHEST NARRATIVE PRIORITY/);
});

test("physical canon formatting is deterministic for long-chat summaries", () => {
  const canon = extractPlayerPhysicalCanon([
    "I am 6 ft 8 in tall.",
    "My weight is 310 lbs.",
    "I cannot be picked up or carried."
  ]);

  assert.deepEqual(canon, {
    heightCentimeters: 203.2,
    weightKilograms: 140.6136347,
    cannotBeLifted: true
  });
  assert.equal(
    formatPlayerPhysicalCanon(canon),
    [
      "[CANONICAL PLAYER PHYSICAL FACTS]",
      "- Height: 203 cm.",
      "- Weight: 141 kg.",
      "- Handling constraint: the player cannot be lifted or carried by another character."
    ].join("\n")
  );
});

test("stream guard rewrites provider violations before they reach the client or storage", () => {
  const guard = createPhysicalContinuityOutputGuard(
    {
      name: "Pick-me rookie | Toto Wolff",
      description: "Toto walks beside the player.",
      personality: "Direct.",
      scenario: "They leave the paddock on the same level."
    },
    "User persona summary: Christopher. 213 cm tall, around 180 kg.",
    { recentMessages: [], currentMessage: "I walk beside Toto." }
  );
  const prefix = "Toto waits by the turnstile. ".repeat(9);
  const output = [
    guard.push(`${prefix}He looks do`),
    guard.push("wn at you, waiting for your answer."),
    guard.flush()
  ].join("");

  assert.match(output, /He looks at you, waiting for your answer\./);
  assert.doesNotMatch(output, /looks down at you/i);
});

test("stream guard preserves external-prompt output and explicit lower posture", () => {
  const character = { name: "Marek", description: "Marek walks nearby.", personality: "Direct.", scenario: null };
  const external = createPhysicalContinuityOutputGuard(
    character,
    "I am 205 cm tall.",
    { recentMessages: [], currentMessage: "Continue." },
    { enabled: false }
  );
  const seated = createPhysicalContinuityOutputGuard(
    character,
    "I am 205 cm tall.",
    { recentMessages: [], currentMessage: "I sit in the chair." }
  );

  assert.equal(external.push("He looks down at you.") + external.flush(), "He looks down at you.");
  assert.equal(seated.push("He looks down at you.") + seated.flush(), "He looks down at you.");
});

test("stream guard rejects impossible handling when the player canon forbids lifting", () => {
  const guard = createPhysicalContinuityOutputGuard(
    { name: "Adrian", description: "Adrian is strong.", personality: "Direct.", scenario: null },
    "I weigh 180 kg and cannot be lifted or carried.",
    { recentMessages: [], currentMessage: "I stay where I am." }
  );
  const output = guard.push("Adrian effortlessly picks you up and smiles.") + guard.flush();

  assert.equal(output, "Adrian tries to lift you, but cannot shift your full weight and smiles.");
});

test("maximum romance is an actionable direction while zero remains non-romantic", () => {
  assert.match(romanceLevelInstruction(10), /maximum scene-supported romantic and intimate intensity/);
  assert.match(romanceLevelInstruction(10), /instead of substituting vague tension, generic tenderness, or a fade to black/);
  assert.match(romanceLevelInstruction(0), /Do not initiate or imply romance/);
});

test("rewind, sidebar refresh, and provider payloads clear every stale context layer", async () => {
  const [rewind, stream, hook, panel, schema] = await Promise.all([
    read("../src/lib/chat-rewind.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/hooks/useChat.ts"),
    read("../src/hooks/use-chat-quick-panel.ts"),
    read("../prisma/schema.prisma")
  ]);

  assert.match(rewind, /summaryThroughSequence/);
  assert.match(rewind, /activeAssistantMessageId/);
  assert.match(rewind, /selectPersistedConversationBranch\(retainedMessages\)/);
  assert.match(stream, /branchMessageId/);
  assert.match(stream, /branchSourceMessageId/);
  assert.match(stream, /maxTokens: maxOutputTokens/);
  assert.match(stream, /includeCheckpoint: !branchInstruction/);
  assert.match(hook, /nythera:chat-context-updated/);
  assert.match(panel, /contextRevision/);
  assert.match(schema, /activeAssistantMessageId\s+String\?/);
  assert.match(schema, /branchSourceMessageId\s+String\?/);
});
