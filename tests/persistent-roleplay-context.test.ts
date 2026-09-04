import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fitPromptMessagesWithinContext, historyTokenBudget, promptContextWindow, selectNewestHistoryWithinBudget } from "../src/lib/prompt-budget";
import { modelContextWindow, UNKNOWN_MODEL_CONTEXT_WINDOW } from "../src/lib/provider-model-options";
import { buildConversationSummary } from "../src/lib/conversation-summary";
import { buildPhysicalContinuityLayer } from "../src/lib/physical-continuity";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("custom prompt replaces the fixed Roleplay Engine after factual context", async () => {
  const source = await read("../src/lib/prompt-assembly.ts");
  assert.match(source, /const contextLayers = \[[\s\S]*safetyLayer,[\s\S]*characterContractLayer,[\s\S]*storyContextLayer,[\s\S]*memoryLayer[\s\S]*\];/);
  assert.match(source, /const behaviorLayers = customPromptLayer[\s\S]*\? \[customPromptLayer\][\s\S]*: \[roleplayEngineLayer, modeLayer\]/);
  assert.match(source, /const system = \[\.\.\.contextLayers, \.\.\.behaviorLayers, physicalContinuityLayer, translationLayer\]/);
  assert.match(source, /Address the player only as you/);
  assert.match(source, /use only the identity and pronouns explicitly authorized by the active player persona/);
  assert.match(source, /Secondary characters stay alive/);
  assert.match(source, /do not wait to be addressed/);
  assert.match(source, /must contribute dialogue and initiative of their own/);
  assert.match(source, /No appending ‘What do you do\?’/);
  assert.match(source, /A configured Custom System Prompt is trusted behavioral authority after platform safety/);
});

test("applicable pinned memories must visibly constrain the current response", async () => {
  const source = await read("../src/lib/prompt-assembly.ts");
  assert.match(source, /Every applicable pinned fact must materially constrain at least one choice, reaction, attitude, or concrete detail/);
  assert.match(source, /include a restrained observable cue when relevant/);
  assert.match(source, /Vary how recurring memories surface/);
  assert.doesNotMatch(source, /Memory may influence relationships and behavior/);
});

test("Extended Prompt persists as an account default and new chats inherit it", async () => {
  const [schema, migration, patchRoute, webCreate, mobileCreate, mobilePatch, branch] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260802130000_prompt_defaults_adaptive_history/migration.sql"),
    read("../src/app/api/chats/[id]/route.ts"),
    read("../src/app/api/chats/route.ts"),
    read("../src/app/api/mobile/chats/route.ts"),
    read("../src/app/api/mobile/chats/[id]/route.ts"),
    read("../src/app/api/chats/[id]/branch/route.ts")
  ]);
  assert.match(schema, /defaultResponsePrompt\s+String\?\s+@db\.Text/);
  assert.match(schema, /summaryThroughSequence\s+Int\s+@default\(0\)/);
  assert.match(migration, /DISTINCT ON \("userId"\)/);
  assert.match(migration, /btrim\("responsePrompt"\) <> ''/);
  assert.match(patchRoute, /defaultResponsePrompt: input\.responsePrompt === undefined \? undefined : input\.responsePrompt \|\| null/);
  assert.match(mobilePatch, /defaultResponsePrompt: input\.responsePrompt === undefined \? undefined : input\.responsePrompt \|\| null/);
  for (const createRoute of [webCreate, mobileCreate]) {
    assert.match(createRoute, /responsePrompt: user\.defaultResponsePrompt/);
  }
  assert.match(branch, /responsePrompt: source\.responsePrompt/);
});

test("adaptive history uses full fitting transcripts, newest overflow, and an 8K custom-model fallback", () => {
  const messages = [
    { id: "new", content: "n".repeat(400) },
    { id: "middle", content: "m".repeat(400) },
    { id: "old", content: "o".repeat(400) }
  ];
  const fitting = selectNewestHistoryWithinBudget(messages, 1_000);
  assert.deepEqual(fitting.selected.map((message) => message.id), ["new", "middle", "old"]);
  assert.equal(fitting.overflowed, false);

  const overflow = selectNewestHistoryWithinBudget(messages, 150);
  assert.deepEqual(overflow.selected.map((message) => message.id), ["new"]);
  assert.equal(overflow.overflowed, true);
  assert.equal(modelContextWindow("custom:unknown-model"), UNKNOWN_MODEL_CONTEXT_WINDOW);
  assert.ok(historyTokenBudget({ model: "custom:unknown-model", maxOutputTokens: 900, currentMessage: "hello" }) < UNKNOWN_MODEL_CONTEXT_WINDOW);
  assert.equal(promptContextWindow("openrouter:x-ai/grok-4.3"), 30_000);
  assert.ok(historyTokenBudget({ model: "openrouter:x-ai/grok-4.3", maxOutputTokens: 1_050, currentMessage: "hello" }) < 30_000);
});

test("the final prompt budget drops oldest history before system instructions", () => {
  const system = { role: "system" as const, content: "s".repeat(12_000) };
  const oldUserMessage = { role: "user" as const, content: "o".repeat(4_000) };
  const oldAssistantMessage = { role: "assistant" as const, content: "a".repeat(4_000) };
  const recentUserMessage = { role: "user" as const, content: "u".repeat(4_000) };
  const recentAssistantMessage = { role: "assistant" as const, content: "r".repeat(4_000) };
  const currentMessage = { role: "user" as const, content: "continue" };
  const fitted = fitPromptMessagesWithinContext(
    [system, oldUserMessage, oldAssistantMessage, recentUserMessage, recentAssistantMessage, currentMessage],
    { model: "custom:unknown-model", maxOutputTokens: 900 }
  );

  assert.equal(fitted.fixedPromptTooLarge, false);
  assert.equal(fitted.droppedMessages, 2);
  assert.deepEqual(fitted.messages, [system, recentUserMessage, recentAssistantMessage, currentMessage]);
});

test("OpenRouter prompts stay below its unpaid-account context gate", () => {
  const system = { role: "system" as const, content: "s".repeat(24_000) };
  const history = Array.from({ length: 220 }, (_, index) => ({
    role: index % 2 === 0 ? "user" as const : "assistant" as const,
    content: `${index}: ${"h".repeat(780)}`
  }));
  const currentMessage = { role: "user" as const, content: "continue" };
  const fitted = fitPromptMessagesWithinContext(
    [system, ...history, currentMessage],
    { model: "openrouter:x-ai/grok-4.3", maxOutputTokens: 1_050 }
  );

  assert.ok(fitted.tokenBudget < 30_000);
  assert.ok(fitted.estimatedTokens <= fitted.tokenBudget);
  assert.ok(fitted.droppedMessages > 0);
  assert.deepEqual(fitted.messages.at(-1), currentMessage);
});

test("rolling summaries extend through a watermark instead of repeatedly summarizing the same turns", async () => {
  const memory = await read("../src/lib/memory.ts");
  const stream = await read("../src/app/api/chats/[id]/stream/route.ts");
  assert.match(memory, /sequence: \{ gt: summaryThroughSequence, lte: cutoffSequence \}/);
  assert.match(memory, /buildConversationSummary\(selectPersistedConversationBranch\(messages\), summary\)/);
  assert.match(memory, /selectPersistedConversationBranch/);
  assert.match(memory, /data: \{ summary, summaryThroughSequence \}/);
  assert.match(memory, /while \(summaryThroughSequence < cutoffSequence\)/);
  assert.match(stream, /loadAdaptiveChatHistory/);
  assert.doesNotMatch(stream, /take: 40/);
});

test("physical player canon is carried across summary compaction and every inference path", async () => {
  const [summaryBuilder, assembly, webRoute, mobileRoute, rooms] = await Promise.all([
    read("../src/lib/conversation-summary.ts"),
    read("../src/lib/prompt-assembly.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts"),
    read("../src/lib/rooms.ts")
  ]);

  assert.match(summaryBuilder, /formatPlayerPhysicalCanon\(extractPlayerPhysicalCanon/);
  assert.match(summaryBuilder, /\[CANONICAL PLAYER PHYSICAL FACTS\]/);
  assert.match(assembly, /persistentPlayerContext: input\.physicalContext/);
  for (const inferencePath of [webRoute, mobileRoute, rooms]) {
    assert.match(inferencePath, /const physicalContext = buildPhysicalMemoryContext/);
    assert.match(inferencePath, /physicalContext,/);
    assert.match(inferencePath, /createPhysicalContinuityOutputGuard/);
  }
});

test("rolling summary output retains user-authored mass and handling facts verbatim as canon", () => {
  const first = buildConversationSummary([
    { role: "USER", content: "I am 205 cm tall, weigh 132 kg, and cannot be lifted or carried." },
    { role: "ASSISTANT", content: "You are only 160 cm tall and weigh 50 kg, so he casually picks you up anyway." }
  ]);
  const rolled = buildConversationSummary(
    [
      { role: "USER", content: "I point toward the northern road." },
      { role: "ASSISTANT", content: "He studies the map." }
    ],
    first
  );

  assert.match(rolled ?? "", /\[CANONICAL PLAYER PHYSICAL FACTS\]/);
  assert.match(rolled ?? "", /- Height: 205 cm\./);
  assert.match(rolled ?? "", /- Weight: 132 kg\./);
  assert.match(rolled ?? "", /- Handling constraint: the player cannot be lifted or carried/);
});

test("a tall player persona prevents unspecified-height NPCs from being narrated above the player", () => {
  const layer = buildPhysicalContinuityLayer(
    {
      name: "Pick-me rookie | Toto Wolff",
      description: "A new driver joins the team.",
      personality: "Toto and the other paddock characters act naturally.",
      scenario: "The player and Toto leave the paddock together."
    },
    "User persona summary: Christopher. 213 cm tall, around 180 kg.",
    {
      recentMessages: [],
      currentMessage: "I walk beside Toto toward the exit."
    }
  );

  assert.match(layer ?? "", /Canonical player height: 213 cm\./);
  assert.match(layer ?? "", /Canonical player weight: 180 kg\./);
  assert.match(layer ?? "", /every character whose height or explicit height relation to the player is not established/);
  assert.match(layer ?? "", /Forbidden for an unspecified-height character at the same elevation: .*looks down at you/);
});

test("chat header links to the character and context exposes memory plus appearance", async () => {
  const [header, tabs, sidePanel] = await Promise.all([
    read("../src/components/chat/ChatHeader.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/components/panel/SidePanel.tsx")
  ]);
  assert.match(header, /aria-label=\{`Open \$\{characterName\} profile`\}/);
  assert.doesNotMatch(header, /<Plus className/);
  assert.match(tabs, /startEditingMemory/);
  assert.match(tabs, /removeMemory/);
  assert.equal((sidePanel.match(/id: "/g) ?? []).length, 9);
  assert.match(sidePanel, /id: "memory"/);
  assert.match(sidePanel, /id: "appearance"/);
});
