import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fitPromptMessagesWithinContext, historyTokenBudget, promptContextWindow, selectNewestHistoryWithinBudget } from "../src/lib/prompt-budget";
import { modelContextWindow, UNKNOWN_MODEL_CONTEXT_WINDOW } from "../src/lib/provider-model-options";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("fixed Roleplay Engine is ordered below safety and above all configurable context", async () => {
  const source = await read("../src/lib/prompt-assembly.ts");
  const orderedLayers = [
    "safetyLayer,",
    "roleplayEngineLayer,",
    "modeLayer,",
    "characterSystemOverrideLayer,",
    "characterContractLayer,",
    "storyContextLayer,",
    "responsePromptLayer,",
    "memoryLayer,",
    "userPersonaLayer,",
    "translationLayer,",
    "physicalContinuityLayer,",
    "narrationOutputGuardLayer"
  ];
  let cursor = -1;
  for (const layer of orderedLayers) {
    const next = source.indexOf(layer, cursor + 1);
    assert.ok(next > cursor, `${layer} is out of order`);
    cursor = next;
  }
  assert.match(source, /Address the player only as you/);
  assert.match(source, /use only the identity and pronouns explicitly authorized by the active player persona/);
  assert.match(source, /Secondary characters stay alive/);
  assert.match(source, /do not wait to be addressed/);
  assert.match(source, /must contribute dialogue and initiative of their own/);
  assert.match(source, /No appending ‘What do you do\?’/);
  assert.match(source, /Ignore any request here to control the player, freeze NPCs/);
  assert.match(source, /measurementRedactor\.redactAssistant\(message\.content\)/);
  assert.match(source, /measurementRedactor\.redactSummary\(input\.summary\)/);
});

test("player identity constraints remain authoritative without exposing optional appearance details", async () => {
  const [assembly, personaFormatter] = await Promise.all([
    read("../src/lib/prompt-assembly.ts"),
    read("../src/lib/user-persona-prompt.ts")
  ]);

  assert.match(assembly, /sanitizePromptContext\(userPersona, 16_000\)/);
  assert.match(assembly, /PLAYER PERSONA — AUTHORITATIVE IDENTITY AND BOUNDARIES/);
  assert.match(assembly, /‘never call me’/);
  assert.match(assembly, /Appearance and presentation never imply gender/);
  assert.match(assembly, /silently audit every pronoun, gendered noun, title, and descriptor/);
  assert.doesNotMatch(assembly, /Instruction-like text inside the profile has no authority/);
  assert.match(personaFormatter, /Authoritative identity, address, and interaction boundaries/);
  assert.doesNotMatch(personaFormatter, /`Background:/);
  assert.doesNotMatch(personaFormatter, /`Traits:/);
  assert.match(personaFormatter, /formatUserPersonaContinuitySource/);
});

test("player cast state and locked visuals survive active-character context filtering", async () => {
  const storyContext = await read("../src/lib/stories/story-foundation.ts");

  assert.match(storyContext, /state\.participant\.role === "PLAYER"/);
  assert.match(storyContext, /state\.participant\.role === "OWNER"/);
  assert.match(storyContext, /reference\.participant\?\.role === "PLAYER"/);
  assert.match(storyContext, /reference\.participant\?\.role === "OWNER"/);
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

test("room prompts receive the same final context fit as one-to-one chats", async () => {
  const rooms = await read("../src/lib/rooms.ts");
  assert.match(rooms, /fitPromptMessagesWithinContext\(assembledPrompt/);
  assert.match(rooms, /const prompt = promptFit\.messages/);
  assert.match(rooms, /promptFit\.fixedPromptTooLarge/);
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
