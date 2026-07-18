import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("continuity and media schema is additive and normalized", async () => {
  const [schema, migration] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260718193000_story_continuity_media/migration.sql")
  ]);
  for (const expected of ["model StoryParticipantState {", "model StoryVoiceBinding {", "model StoryVisualReference {", "model StoryCheckpoint {"]) {
    assert.ok(schema.includes(expected), `schema missing ${expected}`);
  }
  assert.match(schema, /@@unique\(\[timelineId, participantId\]\)/);
  assert.match(schema, /@@unique\(\[storyId, participantId\]\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DROP INDEX/);
});

test("continuity API owns state, voices, visual references, and checkpoints", async () => {
  const [store, route, validation] = await Promise.all([
    read("../src/lib/stories/continuity-store.ts"),
    read("../src/app/api/stories/[id]/continuity/route.ts"),
    read("../src/lib/validation.ts")
  ]);
  assert.match(store, /ownerId: userId/);
  assert.match(store, /upsertStoryParticipantState/);
  assert.match(store, /upsertStoryVoiceBinding/);
  assert.match(store, /create: \{ storyId, participantId: input\.participantId, \.\.\.data \}/);
  assert.doesNotMatch(store, /create: \{ storyId, \.\.\.input \}/);
  assert.match(store, /createStoryVisualReference/);
  assert.match(store, /createStoryCheckpoint/);
  assert.match(store, /ensureAutomaticStoryCheckpoint/);
  assert.match(route, /storyContinuityMutationSchema/);
  assert.match(validation, /storyVisualReferenceSchema/);
});

test("dynamic state, locked visuals, and checkpoints enter the story prompt", async () => {
  const foundation = await read("../src/lib/stories/story-foundation.ts");
  assert.match(foundation, /DYNAMIC PARTICIPANT STATE/);
  assert.match(foundation, /LOCKED VISUAL CONTINUITY/);
  assert.match(foundation, /LATEST CONTINUITY CHECKPOINT/);
  assert.match(foundation, /ensureAutomaticStoryCheckpoint/);
});

test("voice synthesis resolves a story-specific character voice", async () => {
  const [voiceRoute, room] = await Promise.all([
    read("../src/app/api/voice/synthesize/route.ts"),
    read("../src/app/(main)/room/[id]/page.tsx")
  ]);
  assert.match(voiceRoute, /storyVoiceBinding\.findFirst/);
  assert.match(voiceRoute, /participant: \{ characterId: input\.characterId \}/);
  assert.match(voiceRoute, /voice_settings: \{ speed:/);
  assert.match(voiceRoute, /speed: input\.speed/);
  assert.match(room, /storyId: room\?\.storyId/);
  assert.match(room, /characterId: messageToSpeak\.character\?\.id/);
});

test("Story Context exposes cast state, voices, visuals, and resume checkpoints", async () => {
  const [panel, tabs, hook] = await Promise.all([
    read("../src/components/panel/SidePanel.tsx"),
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/hooks/use-chat-quick-panel.ts")
  ]);
  assert.match(panel, /id: "cast"/);
  assert.match(panel, /<CastTabContent/);
  assert.match(tabs, /Dynamic identity/);
  assert.match(tabs, /Story voice/);
  assert.match(tabs, /Visual continuity/);
  assert.match(tabs, /Continuity checkpoint/);
  assert.match(hook, /saveStoryCastState/);
  assert.match(hook, /addStoryVisualReference/);
  assert.match(hook, /addStoryCheckpoint/);
});
