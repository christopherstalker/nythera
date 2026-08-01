import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web and mobile character mutations share one persistence contract", async () => {
  const [webCreate, mobileCreate, webUpdate, mobileUpdate, mutations] = await Promise.all([
    readFile(new URL("../src/app/api/characters/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/characters/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/characters/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/characters/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/character-mutations.ts", import.meta.url), "utf8")
  ]);

  assert.match(webCreate, /createCharacterForUser\(input, user\)/);
  assert.match(mobileCreate, /createCharacterForUser\(input, user\)/);
  assert.match(webUpdate, /updateCharacterForUser/);
  assert.match(mobileUpdate, /updateCharacterForUser/);
  assert.match(mutations, /normalizeCharacterTags/);
  assert.match(mutations, /creationMode.*character\.creationMode/s);
  assert.match(mutations, /revalidateTag\("public-character-feed"\)/);
});

test("character surfaces revalidate across devices instead of keeping mount-time data", async () => {
  const [profile, explore, library, form] = await Promise.all([
    readFile(new URL("../src/components/character/character-profile-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/explore/explore-page-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(main)/library/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8")
  ]);

  for (const source of [profile, explore, library]) {
    assert.match(source, /visibilitychange/);
    assert.match(source, /30_000/);
  }
  assert.match(profile, /cache:\s*"no-store"/);
  assert.match(explore, /cache:\s*"no-store"/);
  assert.match(form, /nythera:characters-updated/);
});
