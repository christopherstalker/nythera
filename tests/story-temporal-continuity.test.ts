import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { storyFactCreateSchema, storySceneAdvanceSchema } from "../src/lib/validation";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("canon distinguishes permanent facts, temporary states, and past events", () => {
  const base = { predicate: "is", objectText: "The bridge is closed.", scope: "STORY" as const, locked: false, participantIds: [] };
  assert.equal(storyFactCreateSchema.safeParse({ ...base, kind: "PERMANENT" }).success, true);
  assert.equal(storyFactCreateSchema.safeParse({ ...base, kind: "STATE", worldTime: "Day 3, morning" }).success, true);
  assert.equal(storyFactCreateSchema.safeParse({ ...base, kind: "EVENT", worldTime: "Day 2" }).success, true);
});

test("scene advancement validates a complete next-scene snapshot", () => {
  const parsed = storySceneAdvanceSchema.parse({
    sceneTitle: "The following morning",
    time: "Day 4, morning",
    location: "North gate",
    weather: "Clear",
    inventory: ["Map"],
    conditions: ["Tired"],
    threats: ["Patrol"],
    notes: [],
    previousSceneSummary: "They escaped before dawn.",
    carryInventory: true
  });
  assert.equal(parsed.sceneTitle, "The following morning");
  assert.equal(parsed.carryInventory, true);
});

test("temporal continuity migration is additive and backfills active scenes", async () => {
  const [schema, migration, prompt, store, tabs] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260824160000_story_temporal_continuity/migration.sql"),
    read("../src/lib/stories/story-foundation.ts"),
    read("../src/lib/stories/canon-store.ts"),
    read("../src/components/chat/chat-panel-tabs.tsx")
  ]);

  assert.match(schema, /enum StoryFactKind/);
  assert.match(schema, /model StoryScene/);
  assert.match(migration, /UPDATE "StoryFact"[\s\S]*'STATE'/);
  assert.match(migration, /StoryScene_one_active_per_timeline_idx/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DROP INDEX/);
  assert.match(prompt, /PAST EVENT[\s\S]*never stage it again/);
  assert.match(prompt, /never rewind to this snapshot/);
  assert.match(store, /validUntilSequence: currentSequence/);
  assert.match(store, /explicitSceneTransition/);
  assert.match(prompt, /reconcileExplicitSceneTransition/);
  assert.match(tabs, /New scene \/ day/);
});

test("ready plot beats are consumed after one generated turn", async () => {
  const [prompt, narrative, stream] = await Promise.all([
    read("../src/lib/stories/story-foundation.ts"),
    read("../src/lib/stories/narrative-store.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts")
  ]);
  assert.match(prompt, /status: "READY"/);
  assert.doesNotMatch(prompt, /status: \{ in: \["READY", "PLANNED"\] \}/);
  assert.match(narrative, /markStoryBeatsCompleted/);
  assert.match(stream, /story beat completion/);
});
