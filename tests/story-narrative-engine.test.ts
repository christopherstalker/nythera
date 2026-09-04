import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("narrative engine schema and migration are additive and timeline aware", async () => {
  const [schema, migration] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260718183000_story_narrative_engine/migration.sql")
  ]);

  for (const expected of [
    "model StoryDirectorProfile {",
    "model StoryArc {",
    "model StoryBeat {",
    "model StoryHook {",
    "model StoryRelationshipState {",
    "model StoryProactiveEvent {",
    "enum StoryPacing",
    "enum StoryProactiveStatus"
  ]) {
    assert.ok(schema.includes(expected), `schema missing ${expected}`);
  }
  for (const expected of [
    'CREATE TABLE "StoryDirectorProfile"',
    'CREATE TABLE "StoryArc"',
    'CREATE TABLE "StoryBeat"',
    'CREATE TABLE "StoryHook"',
    'CREATE TABLE "StoryRelationshipState"',
    'CREATE TABLE "StoryProactiveEvent"'
  ]) {
    assert.ok(migration.includes(expected), `migration missing ${expected}`);
  }
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DROP INDEX/);
  assert.doesNotMatch(migration, /ALTER COLUMN "updatedAt" DROP DEFAULT/);
});

test("narrative store validates ownership and exposes every narrative primitive", async () => {
  const [store, route, validation] = await Promise.all([
    read("../src/lib/stories/narrative-store.ts"),
    read("../src/app/api/stories/[id]/narrative/route.ts"),
    read("../src/lib/validation.ts")
  ]);

  assert.match(store, /ownerId: userId/);
  assert.match(store, /resolveOwnedNarrativeContext/);
  assert.match(store, /createStoryArc/);
  assert.match(store, /createStoryBeat/);
  assert.match(store, /createStoryHook/);
  assert.match(store, /upsertStoryRelationship/);
  assert.match(store, /createStoryProactiveEvent/);
  assert.match(store, /markStoryProactiveEventsFired/);
  assert.match(route, /storyNarrativeCreateSchema/);
  assert.match(route, /storyNarrativeUpdateSchema/);
  assert.match(validation, /export const storyDirectorSchema/);
});

test("prompt assembly consumes director, arc, hook, relationship, and due-event context", async () => {
  const [foundation, stream, rooms] = await Promise.all([
    read("../src/lib/stories/story-foundation.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/lib/rooms.ts")
  ]);

  assert.match(foundation, /NARRATIVE DIRECTOR/);
  assert.match(foundation, /ACTIVE STORY ARCS/);
  assert.match(foundation, /NEXT STORY BEATS/);
  assert.match(foundation, /OPEN HOOKS/);
  assert.match(foundation, /RELATIONSHIP STATE/);
  assert.match(foundation, /DUE PROACTIVE EVENTS/);
  assert.match(stream, /markStoryProactiveEventsFired/);
  assert.match(rooms, /markStoryProactiveEventsFired/);
});

test("Story Context provides editable plot and director controls", async () => {
  const [panel, tabs, hook] = await Promise.all([
    read("../src/components/panel/SidePanel.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/hooks/use-chat-quick-panel.ts")
  ]);

  assert.match(panel, /id: "plot"/);
  assert.match(panel, /<PlotTabContent/);
  assert.match(tabs, /Arcs & beats/);
  assert.match(tabs, /Open hooks/);
  assert.match(tabs, /Relationship state/);
  assert.match(tabs, /Character initiative/);
  assert.match(hook, /saveStoryDirector/);
  assert.match(hook, /addStoryArc/);
  assert.match(hook, /addStoryEvent/);
});
