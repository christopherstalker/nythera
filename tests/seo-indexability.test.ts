import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("crawler endpoints publish the canonical public archive", async () => {
  const [robots, sitemap] = await Promise.all([
    read("../src/app/robots.ts"),
    read("../src/app/sitemap.ts")
  ]);

  assert.match(robots, /sitemap: `\$\{CANONICAL_SITE_ORIGIN\}\/sitemap\.xml`/);
  assert.match(robots, /"\/api\/"/);
  assert.match(robots, /"\/character\/\*\/edit"/);
  assert.match(sitemap, /visibility: "PUBLIC"/);
  assert.match(sitemap, /moderationStatus: "APPROVED"/);
  assert.match(sitemap, /isNSFW: false/);
  assert.match(sitemap, /DISCOVERY_TAGS/);
  assert.match(sitemap, /\/ai-roleplay/);
  assert.match(sitemap, /\/roleplay-characters/);
});

test("public discovery and character pages send indexable server HTML", async () => {
  const [explorePage, characterPage, characterClient] = await Promise.all([
    read("../src/app/(main)/explore/page.tsx"),
    read("../src/app/(main)/character/[id]/page.tsx"),
    read("../src/components/character/character-profile-client.tsx")
  ]);

  assert.match(explorePage, /getPublicCharacters/);
  assert.match(explorePage, /initialCharacters=\{characters\}/);
  assert.match(explorePage, /canonical: "\/explore"/);
  assert.match(characterPage, /generateMetadata/);
  assert.match(characterPage, /getPublicCharacterProfile/);
  assert.match(characterPage, /"@type": "ProfilePage"/);
  assert.match(characterPage, /initialCharacter=\{character\}/);
  assert.match(characterClient, /useState<PublicCharacterProfile \| null>\(initialCharacter\)/);
});

test("SEO landings extend the shared character tag catalog", async () => {
  const [tagPage, landingPage, home] = await Promise.all([
    read("../src/app/tags/[slug]/page.tsx"),
    read("../src/components/seo/seo-landing-page.tsx"),
    read("../src/components/home/home-page-client.tsx")
  ]);

  assert.match(tagPage, /DISCOVERY_TAGS\.map/);
  assert.match(tagPage, /createTagLandingContent/);
  assert.match(tagPage, /export const revalidate = 60/);
  assert.match(landingPage, /getSeoCharactersForTags/);
  assert.match(landingPage, /href=\{`\/tags\/\$\{tag\.slug\}`\}/);
  assert.match(home, /Stories that remember you\./);
  assert.match(home, /href="\/ai-roleplay"/);
  assert.match(home, /DISCOVERY_TAGS\.slice/);
});
