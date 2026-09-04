import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("story safety schema and migration are additive", async () => {
  const [schema, migration] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260718203000_story_safety_portability/migration.sql")
  ]);
  assert.match(schema, /model StorySafetyProfile \{/);
  assert.match(schema, /enum StoryContentRating \{/);
  assert.match(schema, /storySnapshot\s+Json\?/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DROP INDEX/);
});

test("session safety is validated, owner-scoped, and authoritative in prompts", async () => {
  const [route, store, validation, prompt] = await Promise.all([
    read("../src/app/api/stories/[id]/safety/route.ts"),
    read("../src/lib/stories/safety-store.ts"),
    read("../src/lib/validation.ts"),
    read("../src/lib/stories/story-foundation.ts")
  ]);
  assert.match(route, /storySafetySchema/);
  assert.match(store, /ownerId: userId/);
  assert.match(validation, /hardLimits:[\s\S]*softLimits:[\s\S]*fadeToBlack:/);
  assert.match(prompt, /SESSION SAFETY \(AUTHORITATIVE\)/);
  assert.match(prompt, /do not advance the fiction/);
  assert.match(prompt, /safety check-in is due now/);
});

test("story packages separate private exports from public share snapshots", async () => {
  const [portability, exportRoute, shareRoute, sharePage, tabs] = await Promise.all([
    read("../src/lib/stories/story-portability.ts"),
    read("../src/app/api/stories/[id]/export/route.ts"),
    read("../src/app/api/chats/[id]/share/route.ts"),
    read("../src/app/share/[id]/page.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx")
  ]);
  assert.match(portability, /publicView/);
  assert.match(portability, /fact\.scope === "STORY"/);
  assert.match(portability, /fact\.timelineId === activeTimelineId/);
  assert.match(portability, /arc\.timelineId === activeTimelineId/);
  assert.match(portability, /directorOnly/);
  assert.match(portability, /key !== "notes"/);
  assert.match(exportRoute, /content-disposition/);
  assert.match(shareRoute, /createStoryPackage\(chat\.storyId, user\.id, true\)/);
  assert.match(sharePage, /Public canon/);
  assert.match(tabs, /Story package/);
  assert.match(tabs, /format=markdown/);
});
