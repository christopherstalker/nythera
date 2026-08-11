import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPhysicalContinuityLayer } from "../src/lib/physical-continuity";
import {
  maxOutputTokensForVerbosity,
  providerOutputTokenBudget,
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
  assert.match(responseLengthTarget("balanced"), /stay within 140-320 words/);
  assert.match(responseLengthTarget("immersive"), /stay within 320-650 words/);
  assert.equal(maxOutputTokensForVerbosity("concise"), 240);
  assert.equal(maxOutputTokensForVerbosity("balanced"), 520);
  assert.equal(maxOutputTokensForVerbosity("immersive"), 1_050);
  assert.equal(maxOutputTokensForVerbosity("immersive", 700), 700);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 520, provider: "openai", model: "gpt-5" }), 520);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 520, provider: "gemini", model: "gemini-2.5-flash" }), 2_056);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 1_050, provider: "gemini", model: "gemini-3.6-flash" }), 2_586);
  assert.equal(providerOutputTokenBudget({ visibleTokenLimit: 520, provider: "gemini", model: "failover-proof:failover-model" }), 2_056);
});

test("explicit character and player heights become authoritative spatial constraints", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      description: "Marek is 178 cm tall.",
      personality: "Reserved and observant.",
      scenario: null
    },
    "Active user persona: Rowan\nUser persona summary: Rowan is 213 cm tall."
  );

  assert.match(layer ?? "", /Character measurements: Marek is 178 cm tall/);
  assert.match(layer ?? "", /Player measurements: .*Rowan is 213 cm tall/);
  assert.match(layer ?? "", /Do not describe a shorter standing character as looking down at a taller standing character/);
});

test("maximum romance is an actionable direction while zero remains non-romantic", () => {
  assert.match(romanceLevelInstruction(10), /actively advance established, consensual romance in each response/);
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
  assert.match(stream, /maxTokens: providerMaxOutputTokens/);
  assert.match(stream, /includeCheckpoint: !branchInstruction/);
  assert.match(hook, /nythera:chat-context-updated/);
  assert.match(panel, /contextRevision/);
  assert.match(schema, /activeAssistantMessageId\s+String\?/);
  assert.match(schema, /branchSourceMessageId\s+String\?/);
});
