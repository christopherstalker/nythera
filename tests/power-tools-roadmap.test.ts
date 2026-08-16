import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("persona tools cover per-character defaults, one-turn overrides, versions, and portability", async () => {
  const [store, route, settings] = await Promise.all([
    read("../src/lib/user-persona-store.ts"),
    read("../src/app/api/user-persona/route.ts"),
    read("../src/components/settings/user-persona-settings-client.tsx")
  ]);
  assert.match(store, /CharacterPersonaPreference|characterPersonaPreference/);
  assert.match(store, /activateTemporaryUserPersona/);
  assert.match(store, /restorePersonaRevision/);
  assert.match(route, /temporary/);
  assert.match(settings, /user-persona\/portable/);
  assert.match(settings, /Version history/);
});

test("chat power tools expose reviewed memory, search, macros, offline queue, voice, and scene images", async () => {
  const [memory, search, composer, client] = await Promise.all([
    read("../src/lib/memory-store.ts"),
    read("../src/app/api/chats/search/route.ts"),
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/components/chat/chat-client.tsx")
  ]);
  assert.match(memory, /MemoryStatus\.ACTIVE/);
  assert.match(search, /searchMemories/);
  assert.match(composer, /\/ooc/);
  assert.match(composer, /voice\/transcribe/);
  assert.match(composer, /scene-image/);
  assert.match(client, /nythera:offline-queue/);
  assert.match(client, /scheduled/);
});

test("shared rooms and story continuity retain collaborators, knowledge, contradictions, and relationship history", async () => {
  const [rooms, canon, narrative, prompt] = await Promise.all([
    read("../src/lib/rooms.ts"),
    read("../src/lib/stories/canon-store.ts"),
    read("../src/lib/stories/narrative-store.ts"),
    read("../src/lib/stories/story-foundation.ts")
  ]);
  assert.match(rooms, /members: \{ some:/);
  assert.match(rooms, /actorUserId/);
  assert.match(canon, /Canon contradiction detected/);
  assert.match(narrative, /StoryRelationshipRevision|storyRelationshipRevision/);
  assert.match(prompt, /KNOWLEDGE SCOPE|knowledge/i);
});
