import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { storyFactCreateSchema } from "../src/lib/validation";

test("canonical facts accept punctuation and detailed text", () => {
  const base = {
    predicate: "is true now",
    scope: "STORY" as const,
    locked: false,
    participantIds: []
  };
  assert.equal(storyFactCreateSchema.safeParse({ ...base, objectText: "The promise still stands." }).success, true);
  assert.equal(storyFactCreateSchema.safeParse({ ...base, objectText: "A".repeat(6000) }).success, true);
  assert.equal(storyFactCreateSchema.safeParse({ ...base, objectText: "A".repeat(6001) }).success, false);
});

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("story foundation is represented in Prisma schema and an additive migration", async () => {
  const [schema, migration] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260718160000_story_foundation/migration.sql")
  ]);

  for (const expected of [
    "model Story {",
    "model StoryParticipant {",
    "model StoryTimeline {",
    "model StoryTurn {",
    "model StoryEntity {",
    "model StoryFact {",
    "model StoryKnowledge {",
    "model StoryStateSnapshot {",
    "enum StoryFactScope",
    "timelineId     String?   @unique"
  ]) {
    assert.ok(schema.includes(expected), `schema missing ${expected}`);
  }

  for (const expected of [
    'CREATE TABLE "Story"',
    'CREATE TABLE "StoryFact"',
    'CREATE TABLE "StoryKnowledge"',
    'CREATE TABLE "StoryStateSnapshot"',
    'ALTER TABLE "Chat" ADD COLUMN',
    'ALTER TABLE "Room" ADD COLUMN'
  ]) {
    assert.ok(migration.includes(expected), `migration missing ${expected}`);
  }
  assert.doesNotMatch(migration, /DROP INDEX "Memory_embedding_ivfflat_idx"/);
  assert.doesNotMatch(migration, /ALTER COLUMN "updatedAt" DROP DEFAULT/);
});

test("legacy chat and room surfaces adopt the shared story engine", async () => {
  const [foundation, chats, rooms, stream, branch] = await Promise.all([
    read("../src/lib/stories/story-foundation.ts"),
    read("../src/app/api/chats/route.ts"),
    read("../src/lib/rooms.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/chats/[id]/branch/route.ts")
  ]);

  assert.match(foundation, /export async function ensureStoryForChat/);
  assert.match(foundation, /export async function ensureStoryForRoom/);
  assert.match(foundation, /export async function syncChatTurns/);
  assert.match(foundation, /export async function syncRoomTurns/);
  assert.match(chats, /ensureStoryForChat\(chat\.id, user\.id\)/);
  assert.match(rooms, /ensureStoryForRoom\(created\.id, user\.id\)/);
  assert.match(stream, /storyContext: storyContext\.text/);
  assert.match(rooms, /storyContext: storyContext\.text/);
  assert.match(branch, /parentTimelineId: foundation\.timelineId/);
  assert.match(branch, /inheritedFromFactId/);
});

test("canon and world-state routes share validated stores and enforce ownership", async () => {
  const [store, canonRoute, stateRoute, validation] = await Promise.all([
    read("../src/lib/stories/canon-store.ts"),
    read("../src/app/api/stories/[id]/canon/route.ts"),
    read("../src/app/api/stories/[id]/state/route.ts"),
    read("../src/lib/validation.ts")
  ]);

  assert.match(store, /assertStoryAccess\(storyId, userId, true\)/);
  assert.match(store, /ownerId: userId/);
  assert.match(store, /stateVersion: \{ increment: 1 \}/);
  assert.match(canonRoute, /storyFactCreateSchema/);
  assert.match(canonRoute, /storyFactUpdateSchema/);
  assert.match(stateRoute, /storyStateSchema/);
  assert.match(validation, /export const storyFactCreateSchema/);
  assert.match(validation, /export const storyStateSchema/);
});

test("Story Context exposes scene and canon without duplicating the memory store", async () => {
  const [panel, tabs, hook] = await Promise.all([
    read("../src/components/panel/SidePanel.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/hooks/use-chat-quick-panel.ts")
  ]);

  assert.match(panel, /id: "scene"/);
  assert.match(panel, /id: "canon"/);
  assert.match(panel, /<SceneTabContent/);
  assert.match(panel, /<CanonTabContent/);
  assert.match(tabs, /Who knows this/);
  assert.match(tabs, /linked to source message/);
  assert.match(hook, /\/api\/stories\/resolve/);
  assert.match(hook, /updateCanonFact/);
  assert.match(hook, /saveStoryState/);
});

test("active canon is always injected as authoritative context", async () => {
  const [foundation, assembly, tabs, hook] = await Promise.all([
    read("../src/lib/stories/story-foundation.ts"),
    read("../src/lib/prompt-assembly.ts"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/hooks/use-chat-quick-panel.ts")
  ]);

  assert.match(foundation, /orderBy: \[\{ updatedAt: "desc" \}, \{ locked: "desc" \}, \{ importance: "desc" \}\]/);
  assert.match(foundation, /Every recorded fact below is binding world truth/);
  assert.match(foundation, /NOT KNOWN BY ACTIVE CHARACTER/);
  assert.match(foundation, /sanitizePromptContext\(fact\.objectText, 2400\)/);
  assert.match(assembly, /sanitizePromptContext\(value, 18000\)/);
  assert.match(hook, /Choose at least one character who knows this fact/);
  assert.match(tabs, /missingKnowledgeParticipant/);
});
