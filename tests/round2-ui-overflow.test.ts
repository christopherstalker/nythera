import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Recent sidebar rows clip long one-line descriptions inside their rounded container", async () => {
  const source = await readFile(new URL("../src/components/layout/Sidebar.tsx", import.meta.url), "utf8");

  assert.match(source, /className=\{cn\("nav-item !h-12 overflow-hidden px-2"/);
  assert.match(source, /<p className="block truncate text-xs font-normal/);
});

test("Chats-tab rows clip and sanitize last-message previews", async () => {
  const source = await readFile(new URL("../src/components/chat/chat-panel-tabs.tsx", import.meta.url), "utf8");

  assert.match(source, /flex items-center gap-3 overflow-hidden rounded-2xl/);
  assert.match(source, /className="mt-0\.5 block truncate text-xs/);
  assert.match(source, /toChatPreview\(chat\.messages\[0\]\?\.content/);
});
