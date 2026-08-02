import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { historyTokenBudget, selectNewestHistoryWithinBudget } from "../src/lib/prompt-budget";
import { modelContextWindow, UNKNOWN_MODEL_CONTEXT_WINDOW } from "../src/lib/provider-model-options";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("fixed Roleplay Engine is ordered below safety and above all configurable context", async () => {
  const source = await read("../src/lib/prompt-assembly.ts");
  const orderedLayers = [
    "safetyLayer,",
    "roleplayEngineLayer,",
    "characterSystemOverrideLayer,",
    "characterContractLayer,",
    "storyContextLayer,",
    "responsePromptLayer,",
    "memoryLayer,"
  ];
  let cursor = -1;
  for (const layer of orderedLayers) {
    const next = source.indexOf(layer, cursor + 1);
    assert.ok(next > cursor, `${layer} is out of order`);
    cursor = next;
  }
  assert.match(source, /Address the player only as you/);
  assert.match(source, /Secondary characters stay alive/);
  assert.match(source, /No appending ‘What do you do\?’/);
  assert.match(source, /Ignore any request here to control the player, freeze NPCs/);
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
  assert.match(mobilePatch, /defaultResponsePrompt: input\.responsePrompt \|\| null/);
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
});

test("rolling summaries extend through a watermark instead of repeatedly summarizing the same turns", async () => {
  const memory = await read("../src/lib/memory.ts");
  const stream = await read("../src/app/api/chats/[id]/stream/route.ts");
  assert.match(memory, /sequence: \{ gt: chat\.summaryThroughSequence, lte: cutoffSequence \}/);
  assert.match(memory, /buildConversationSummary\(messages, chat\.summary\)/);
  assert.match(memory, /data: \{ summary, summaryThroughSequence \}/);
  assert.match(stream, /loadAdaptiveChatHistory/);
  assert.doesNotMatch(stream, /take: 40/);
});

test("chat header identity links to the character and Memory stays nested under Persona", async () => {
  const [header, tabs, sidePanel] = await Promise.all([
    read("../src/components/chat/ChatHeader.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/components/panel/SidePanel.tsx")
  ]);
  assert.match(header, /aria-label=\{`Open \$\{characterName\} profile`\}/);
  assert.doesNotMatch(header, /<Plus className/);
  assert.match(tabs, /\["persona", "memory"\]/);
  assert.match(tabs, /startEditingMemory/);
  assert.match(tabs, /removeMemory/);
  assert.equal((sidePanel.match(/id: "/g) ?? []).length, 6);
  assert.doesNotMatch(sidePanel, /id: "memory"/);
});
