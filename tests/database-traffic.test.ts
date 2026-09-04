import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

test("public discovery and profile reads use durable shared caches", async () => {
  const discovery = await readFile(`${root}/src/lib/discovery-feed.ts`, "utf8");
  const profileStore = await readFile(`${root}/src/lib/public-character-profile.ts`, "utf8");
  const profilePage = await readFile(`${root}/src/app/(main)/character/[id]/page.tsx`, "utf8");

  assert.match(discovery, /DISCOVERY_FEED_REVALIDATE_SECONDS\s*=\s*60 \* 60/);
  assert.match(discovery, /DISCOVERY_FEED_STALE_SECONDS\s*=\s*24 \* 60 \* 60/);
  assert.match(profileStore, /unstable_cache/);
  assert.match(profileStore, /public-character-profile-v2/);
  assert.ok(profilePage.indexOf("getPublicCharacterProfile(id)") < profilePage.indexOf("auth()"));
});

test("public pages avoid unnecessary authenticated background reads", async () => {
  const home = await readFile(`${root}/src/components/home/home-page-client.tsx`, "utf8");
  const profile = await readFile(`${root}/src/components/character/character-profile-client.tsx`, "utf8");

  assert.doesNotMatch(home, /void fetch\("\/api\/chats"/);
  assert.match(profile, /sessionStatus === "unauthenticated"/);
  assert.match(profile, /\?view=viewer/);
});

test("chat reads select only fields rendered by conversation surfaces", async () => {
  const chatRoute = await readFile(`${root}/src/app/api/chats/[id]/route.ts`, "utf8");
  const recentChats = await readFile(`${root}/src/lib/recent-chats.ts`, "utf8");

  assert.match(chatRoute, /character:\s*\{\s*select:/);
  assert.doesNotMatch(chatRoute, /character:\s*true/);
  assert.doesNotMatch(chatRoute, /persona:\s*true/);
  assert.match(recentChats, /select:\s*\{\s*id:\s*true,\s*title:\s*true/);
  assert.doesNotMatch(recentChats, /include:\s*\{\s*character:/);
});

test("story synchronization reads only turns that have not been imported", async () => {
  const foundation = await readFile(`${root}/src/lib/stories/story-foundation.ts`, "utf8");

  assert.equal(foundation.match(/where: \{ storyTurn: \{ is: null \} \}/g)?.length, 2);
  assert.match(foundation, /characterId: true,\s*lastActiveAt: true,\s*summary: true,\s*messages:/);
  assert.match(foundation, /role: true,\s*content: true,\s*sequence: true/);
});
