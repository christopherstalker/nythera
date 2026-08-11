import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("message mutation and reporting enforce chat ownership in the database query", async () => {
  const messagesRoute = await readFile(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8");
  const reportRoute = await readFile(new URL("../src/app/api/messages/[id]/report/route.ts", import.meta.url), "utf8");

  assert.match(messagesRoute, /prisma\.message\.findFirst/);
  assert.match(messagesRoute, /chat:\s*\{\s*userId:\s*user\.id/s);
  assert.doesNotMatch(messagesRoute, /message\.chat\.userId\s*!==\s*user\.id/);

  assert.match(reportRoute, /prisma\.message\.findFirst/);
  assert.match(reportRoute, /chat:\s*\{\s*userId:\s*user\.id/s);
});

test("character owner mutations constrain owner or admin before updates", async () => {
  const webRoute = await readFile(new URL("../src/app/api/characters/[id]/route.ts", import.meta.url), "utf8");
  const mobileRoute = await readFile(new URL("../src/app/api/mobile/characters/[id]/route.ts", import.meta.url), "utf8");
  const mutations = await readFile(new URL("../src/lib/character-mutations.ts", import.meta.url), "utf8");

  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /updateCharacterForUser/);
  }
  assert.match(mutations, /prisma\.character\.findFirst/);
  assert.match(mutations, /user\.role === "ADMIN"/);
  assert.match(mutations, /creatorId:\s*user\.id/);
});
