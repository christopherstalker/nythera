import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("last-used model is persisted per user and used for new chats", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const chatsRoute = await readFile(new URL("../src/app/api/chats/route.ts", import.meta.url), "utf8");
  const chatRoute = await readFile(new URL("../src/app/api/chats/[id]/route.ts", import.meta.url), "utf8");

  assert.match(schema, /preferredModel\s+String/);
  assert.match(chatsRoute, /user\.preferredModel/);
  assert.match(chatRoute, /preferredModel: input\.model/);
});
