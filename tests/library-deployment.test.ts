import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

test("Library reports authentication and server failures separately", async () => {
  const source = await readFile(`${root}/src/app/(main)/library/page.tsx`, "utf8");

  assert.match(source, /response\.status === 401/);
  assert.match(source, /Sign in to view your library\./);
  assert.match(source, /Your library could not be loaded\. Please try again\./);
});

test("production builds deploy Prisma migrations before compiling", async () => {
  const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const buildScript = packageJson.scripts?.build ?? "";
  const buildRunner = await readFile(`${root}/scripts/build.mjs`, "utf8").catch(() => "");

  assert.match(buildScript, /node scripts\/build\.mjs/);
  assert.match(buildRunner, /VERCEL_ENV === "production"/);
  assert.ok(buildRunner.indexOf("migrate\", \"deploy") < buildRunner.indexOf("generate"));
});
