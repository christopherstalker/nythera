import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCharacterRoster } from "../src/lib/library-roster";

const root = process.cwd();

test("Library reports authentication and server failures separately", async () => {
  const source = await readFile(`${root}/src/app/(main)/library/page.tsx`, "utf8");

  assert.match(source, /response\.status === 401/);
  assert.match(source, /Sign in to view your library\./);
  assert.match(source, /Your library could not be loaded\. Please try again\./);
  assert.doesNotMatch(source, /setInterval/);
});

test("production builds deploy Prisma migrations before compiling and tolerate database outages", async () => {
  const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const buildScript = packageJson.scripts?.build ?? "";
  const buildRunner = await readFile(`${root}/scripts/build.mjs`, "utf8").catch(() => "");

  assert.match(buildScript, /node scripts\/build\.mjs/);
  assert.match(buildRunner, /VERCEL_ENV === "production"/);
  assert.match(buildRunner, /SKIP_PRISMA_MIGRATE !== "1"/);
  assert.match(buildRunner, /P1001/);
  assert.match(buildRunner, /exceeded the data transfer quota/);
  assert.match(buildRunner, /\.neon\\\.tech/);
  assert.match(buildRunner, /Schema engine error/);
  assert.match(buildRunner, /allowFailure: isTemporaryDatabaseFailure/);
  assert.ok(buildRunner.indexOf("migrate\", \"deploy") < buildRunner.indexOf("generate"));
});

test("character cards open the most recently active chat for that character", () => {
  const roster = buildCharacterRoster({
    mine: [],
    liked: [],
    chats: [
      { id: "latest", lastActiveAt: "2026-08-06T10:00:00.000Z", character: { id: "character-1", name: "Nyx" }, messages: [{ content: "Latest" }] },
      { id: "older", lastActiveAt: "2026-08-05T10:00:00.000Z", character: { id: "character-1", name: "Nyx" }, messages: [{ content: "Older" }] }
    ]
  });

  assert.equal(roster[0]?.chatId, "latest");
  assert.equal(roster[0]?.preview, "Latest");
});

test("library roster sorts characters by their latest chat activity", () => {
  const roster = buildCharacterRoster({
    mine: [],
    liked: [],
    chats: [
      { id: "older", lastActiveAt: "2026-08-18T10:00:00.000Z", character: { id: "popular", name: "A popular bot" }, messages: [{ content: "Old chat" }] },
      { id: "recent", lastActiveAt: "2026-08-24T10:56:00.000Z", character: { id: "recent-bot", name: "Z recent bot" }, messages: [{ content: "Four minutes ago" }] }
    ]
  });

  assert.deepEqual(roster.map((character) => character.chatId), ["recent", "older"]);
});

test("library list previews wrap onto a second line", async () => {
  const source = await readFile(`${root}/src/components/library/character-roster-card.tsx`, "utf8");
  assert.match(source, /line-clamp-2 break-words/);
  assert.doesNotMatch(source, /line-clamp-1 text-xs text-\[var\(--text-secondary\)\]/);
});

test("library roster layout is configured once and mobile rows can shrink", async () => {
  const [page, roster, card] = await Promise.all([
    readFile(`${root}/src/app/(main)/library/page.tsx`, "utf8"),
    readFile(`${root}/src/lib/library-roster.ts`, "utf8"),
    readFile(`${root}/src/components/library/character-roster-card.tsx`, "utf8")
  ]);

  assert.match(roster, /LIBRARY_ROSTER_LAYOUT: LibraryRosterLayout = "list"/);
  assert.match(page, /view=\{LIBRARY_ROSTER_LAYOUT\}/);
  assert.doesNotMatch(page, /setView|Grid view|List view/);
  assert.match(card, /grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
  assert.match(card, /max-w-full/);
});

test("account character cards keep their content and actions inside mobile width", async () => {
  const source = await readFile(`${root}/src/components/account/account-hub-client.tsx`, "utf8");

  assert.match(source, /grid-cols-\[4rem_minmax\(0,1fr\)\]/);
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)_auto_auto\]/);
  assert.match(source, /overflow-x-clip/);
});
