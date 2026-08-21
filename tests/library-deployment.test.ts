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

test("production builds fail closed when Prisma migrations cannot be deployed", async () => {
  const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const buildScript = packageJson.scripts?.build ?? "";
  const buildRunner = await readFile(`${root}/scripts/build.mjs`, "utf8").catch(() => "");

  assert.match(buildScript, /node scripts\/build\.mjs/);
  assert.match(buildRunner, /VERCEL_ENV === "production"/);
  assert.match(buildRunner, /SKIP_PRISMA_MIGRATE !== "1"/);
  assert.match(buildRunner, /result\.status !== 0/);
  assert.match(buildRunner, /process\.exit\(result\.status \?\? 1\)/);
  assert.doesNotMatch(buildRunner, /allowFailure|isTemporaryDatabaseFailure|P1001/);
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

test("library roster sorts chats by latest activity instead of character name", () => {
  const roster = buildCharacterRoster({
    mine: [{ id: "custom", name: "Aster", description: "No chat yet" }],
    liked: [],
    chats: [
      { id: "older", lastActiveAt: "2026-08-05T10:00:00.000Z", character: { id: "character-1", name: "Ada" }, messages: [{ content: "Older" }] },
      { id: "latest", lastActiveAt: "2026-08-07T10:00:00.000Z", character: { id: "character-2", name: "Zara" }, messages: [{ content: "Latest" }] },
      { id: "middle", lastActiveAt: "2026-08-06T10:00:00.000Z", character: { id: "character-3", name: "Mira" }, messages: [{ content: "Middle" }] }
    ]
  });

  assert.deepEqual(roster.map((character) => character.chatId), ["latest", "middle", "older", undefined]);
});
