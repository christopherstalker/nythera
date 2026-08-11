import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Side-panel chat history clips long one-line descriptions inside its rows", async () => {
  const source = await readFile(new URL("../src/components/chat/chat-panel-tabs.tsx", import.meta.url), "utf8");

  assert.match(source, /HistoryTabContent/);
  assert.match(source, /No conversations with this character yet/);
  assert.match(source, /chat\.character\.id === characterId/);
  assert.match(source, /overflow-hidden rounded-2xl/);
  assert.match(source, /className="mt-0\.5 block truncate text-xs/);
});

test("Chats-tab rows clip and sanitize last-message previews", async () => {
  const source = await readFile(new URL("../src/components/chat/chat-panel-tabs.tsx", import.meta.url), "utf8");

  assert.match(source, /flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl/);
  assert.match(source, /className="mt-0\.5 block truncate text-xs/);
  assert.match(source, /toChatPreview\(chat\.messages\[0\]\?\.content/);
});
