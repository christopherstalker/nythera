import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { userPreferredModelValue } from "../src/lib/provider-model-options";

test("last-used provider and model are persisted per user and used for new chats", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const chatsRoute = await readFile(new URL("../src/app/api/chats/route.ts", import.meta.url), "utf8");
  const mobileChatsRoute = await readFile(new URL("../src/app/api/mobile/chats/route.ts", import.meta.url), "utf8");
  const chatRoute = await readFile(new URL("../src/app/api/chats/[id]/route.ts", import.meta.url), "utf8");

  assert.match(schema, /preferredProvider\s+String\?/);
  assert.match(schema, /preferredModel\s+String/);
  assert.match(chatsRoute, /userPreferredModelValue\(user\)/);
  assert.match(mobileChatsRoute, /userPreferredModelValue\(user\)/);
  assert.match(chatRoute, /splitProviderModelValue\(selectedModel\)/);
  assert.match(chatRoute, /preferredProvider: selectedProviderModel\?\.provider \?\? null/);
  assert.match(chatRoute, /preferredModel: selectedProviderModel\?\.model \?\? selectedModel/);
  assert.match(chatRoute, /selectedModel === undefined/);
});

test("user preferred model value preserves custom provider identity", () => {
  assert.equal(
    userPreferredModelValue({ preferredProvider: "my-ollama", preferredModel: "llama3.1" }),
    "my-ollama:llama3.1"
  );
  assert.equal(
    userPreferredModelValue({ preferredProvider: null, preferredModel: "openai:gpt-4o-mini" }),
    "openai:gpt-4o-mini"
  );
});
