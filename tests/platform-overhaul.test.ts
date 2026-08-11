import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("character browser features remain available without replacing the editorial chat dossier", async () => {
  const [sidebar, route, schema, client] = await Promise.all([
    read("../src/components/chat/ChatSidebar.tsx"),
    read("../src/app/api/chat-sidebar/route.ts"),
    read("../prisma/schema.prisma"),
    read("../src/components/chat/chat-client.tsx")
  ]);

  assert.match(sidebar, /Search characters\.\.\./);
  assert.match(sidebar, /Favorites/);
  assert.match(sidebar, /Recent chats/);
  assert.match(sidebar, /ModeSelector/);
  assert.match(sidebar, /touchstart/);
  assert.match(sidebar, /onContextMenu/);
  assert.doesNotMatch(sidebar, />\s*(?:Tools|Plugins)\s*</i);
  assert.match(route, /chatSidebarPin\.(?:findMany|upsert|deleteMany)/);
  assert.match(schema, /model ChatSidebarPin/);
  assert.doesNotMatch(client, /<ChatSidebar/);
  assert.match(client, /Story dossier/);
});

test("tiered memory uses 20 session messages and semantic deduplication", async () => {
  const [stream, vector, worker] = await Promise.all([
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/lib/vector.ts"),
    read("../src/jobs/worker.ts")
  ]);

  assert.match(stream, /history\.messages\.slice\(-20\)/);
  assert.match(stream, /includeGlobal: false/);
  assert.match(vector, /> 0\.92/);
  assert.match(worker, /extractMemoriesWithLlm/);
});

test("roleplay prompt and mode persistence are wired through chat creation", async () => {
  const [prompt, realism, fantasy, assembly, createRoute, schema] = await Promise.all([
    read("../src/lib/prompts/externalSystemPrompt.ts"),
    read("../src/lib/prompts/modes/realismMode.ts"),
    read("../src/lib/prompts/modes/fantasyMode.ts"),
    read("../src/lib/prompt-assembly.ts"),
    read("../src/app/api/chats/route.ts"),
    read("../prisma/schema.prisma")
  ]);

  for (const section of ["SESSION MEMORY", "CHARACTER MEMORY", "USER PREFERENCES"]) {
    assert.match(prompt, new RegExp(`\\[${section}`));
  }
  assert.match(realism, /REALISM MODE — AUTHORITATIVE STYLE/);
  assert.match(realism, /Never supply the player's dialogue, actions, thoughts, feelings, sensations, decisions, or reactions/);
  assert.match(fantasy, /EMBRACE THE FANTASTIC/);
  assert.match(fantasy, /PROTECT THE PLAYER ROLE/);
  assert.match(assembly, /PLAYER PERSONA — REFERENCE ONLY/);
  assert.doesNotMatch(assembly, /4\. Realism over drama/);
  assert.match(createRoute, /character\.defaultChatMode \?\? user\.preferredChatMode/);
  assert.match(schema, /preferredChatMode\s+String\s+@default\("realism"\)/);
  assert.match(schema, /defaultChatMode\s+String\s+@default\("realism"\)/);
});

test("character generation runs three passes and exposes every editable field", async () => {
  const [generator, editor] = await Promise.all([
    read("../src/lib/generation/characterGenerator.ts"),
    read("../src/components/character/BotGenerator.tsx")
  ]);

  assert.equal(generator.match(/callJsonStage\(\{/g)?.length, 3);
  for (const field of ["description", "personality", "background", "speechPattern", "scenario", "firstMessage", "tags", "avatarPrompt"]) {
    assert.match(editor, new RegExp(`preview\\.${field}`));
  }
  assert.match(editor, /Upload avatar/);
  assert.match(editor, /disabled=\{!ready\}/);
});
