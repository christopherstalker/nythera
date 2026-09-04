import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("web and mobile memory routes share the same store contract", async () => {
  const [webRoute, mobileRoute] = await Promise.all([
    read("../src/app/api/memories/route.ts"),
    read("../src/app/api/mobile/memories/route.ts")
  ]);

  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /from "@\/lib\/memory-store"/);
    assert.match(route, /listMemories/);
    assert.match(route, /createManualMemory/);
    assert.match(route, /updateMemory/);
    assert.match(route, /deleteMemory/);
    assert.doesNotMatch(route, /prisma\.memory\.(?:findMany|create|update|updateMany|deleteMany)/);
  }
});

test("editing memory content refreshes the semantic embedding", async () => {
  const store = await read("../src/lib/memory-store.ts");
  const vector = await read("../src/lib/vector.ts");

  assert.match(vector, /export async function writeMemoryEmbedding/);
  assert.match(store, /writeMemoryEmbedding\(updated\.id, updated\.content, input\.providerKeys\)/);
  assert.match(store, /if \(input\.content\)/);
});

test("manual semantic memory search uses the user's effective embedding provider", async () => {
  const [webRoute, mobileRoute] = await Promise.all([
    read("../src/app/api/memories/search/route.ts"),
    read("../src/app/api/mobile/memories/search/route.ts")
  ]);

  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /getEffectiveProviderKeys\(user\.id\)/);
    assert.match(route, /providerKeys/);
    assert.match(route, /searchMemories/);
  }
});

test("prompt memory resolver always leads with pinned character facts and survives semantic failure", async () => {
  const store = await read("../src/lib/memory-store.ts");
  const prompt = await read("../src/lib/prompt-assembly.ts");
  const [webStream, mobileStream, rooms] = await Promise.all([
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts"),
    read("../src/lib/rooms.ts")
  ]);

  assert.match(store, /export async function getPromptMemories/);
  assert.match(store, /characterId: input\.characterId,[\s\S]*pinned: true/);
  assert.ok(store.indexOf("...pinned") < store.indexOf("...semantic"));
  assert.ok(store.indexOf("...semantic") < store.indexOf("...continuity"));
  assert.match(store, /sourceChatId: input\.chatId/);
  assert.match(store, /status: MemoryStatus\.ACTIVE/);
  assert.match(store, /Prompt memory semantic retrieval failed/);
  assert.match(store, /if \(input\.semanticEnabled !== false\)/);
  assert.match(prompt, /PINNED MANUAL FACT — AUTHORITATIVE/);
  assert.match(prompt, /secretly.*subtly.*restrained observable cue/is);
  assert.match(prompt, /Every applicable pinned fact must materially constrain/);
  for (const consumer of [webStream, mobileStream, rooms]) {
    assert.match(consumer, /getPromptMemories/);
    assert.match(consumer, /semanticEnabled:/);
  }
});

test("automatic memories are active immediately and legacy pending rows are promoted", async () => {
  const [memory, extraction, migration] = await Promise.all([
    read("../src/lib/memory.ts"),
    read("../src/lib/memory/extract.ts"),
    read("../prisma/migrations/20260826090000_activate_automatic_memories/migration.sql")
  ]);

  assert.match(memory, /status: MemoryStatus\.ACTIVE/);
  assert.match(extraction, /status: MemoryStatus\.ACTIVE/);
  assert.match(migration, /SET status = 'ACTIVE'::"MemoryStatus"/);
  assert.match(migration, /'contextual-exchange'.*'rule'.*'topic-keyword'.*'llm'/s);
});

test("right-panel persona and manual memory changes are used by the next chat request", async () => {
  const [panelHook, webStream] = await Promise.all([
    read("../src/hooks/use-chat-quick-panel.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts")
  ]);

  assert.match(panelHook, /chatId \? \{ chatId \} : \{\}/);
  assert.match(panelHook, /characterId: characterId \?\? null/);
  assert.match(panelHook, /pinned: true/);
  assert.match(panelHook, /Applied to next reply|saved for the next message/i);
  assert.match(webStream, /persona: true/);
  assert.match(webStream, /const userPersona = chat\.temporaryPersona \?\? chat\.persona \?\? defaultUserPersona/);
  assert.match(webStream, /getPromptMemories\(\{/);
  assert.match(webStream, /formatUserPersonaForPrompt\(userPersona\)/);
  assert.match(webStream, /chat_prompt_context/);
  assert.match(webStream, /personaCharacters: formattedUserPersona\?\.length \?\? 0/);
});
