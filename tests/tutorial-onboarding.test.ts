import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("the playable tutorial uses the published guide without mutating the character", async () => {
  const [tutorial, page, route, constants] = await Promise.all([
    read("../src/components/tutorial/tutorial-experience.tsx"),
    read("../src/app/(main)/tutorial/page.tsx"),
    read("../src/app/api/tutorial/route.ts"),
    read("../src/lib/tutorial.ts")
  ]);

  assert.match(constants, /cmtj0lhg40001l204wqm7wgnp/);
  assert.match(page, /getPublicCharacterProfile\(TUTORIAL_CHARACTER_ID\)/);
  assert.doesNotMatch(tutorial, /api\/characters/);
  assert.match(tutorial, /Skip tutorial/);
  assert.match(tutorial, /This is a scripted preview/);
  assert.match(tutorial, /Memory recalled/);
  assert.match(tutorial, /Branch created/);
  assert.match(route, /tutorialStatus/);
  assert.match(route, /tutorialCompletedAt/);
});

test("tutorial progress is stored per account and replay remains available", async () => {
  const [schema, migration, help, authRoutes, newUser] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260901123000_add_tutorial_progress/migration.sql"),
    read("../src/app/(main)/settings/help/page.tsx"),
    read("../src/lib/auth-routes.ts"),
    read("../src/app/(auth)/auth/new-user/page.tsx")
  ]);

  assert.match(schema, /tutorialStatus\s+String\s+@default\("NOT_STARTED"\)/);
  assert.match(schema, /tutorialState\s+Json\?/);
  assert.match(migration, /ADD COLUMN "tutorialStatus"/);
  assert.match(help, /Replay interactive tutorial/);
  assert.match(authRoutes, /pathname\.startsWith\("\/tutorial"\)/);
  assert.match(newUser, /\/tutorial\?callbackUrl=/);
});

test("long character names wrap inside the profile dossier", async () => {
  const profile = await read("../src/components/character/character-profile-client.tsx");

  assert.match(profile, /max-w-full break-words/);
  assert.match(profile, /\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(profile, /text-\[clamp\(4rem,10vw,7\.5rem\)\]/);
});
