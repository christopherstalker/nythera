import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("message toolbar uses distinct continue, regenerate, and rewind actions", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");

  assert.match(source, /ChevronsRight/);
  assert.match(source, /ActionButton label="Continue"[\s\S]*?<ChevronsRight/);
  assert.match(source, /ActionButton label="Regenerate"[\s\S]*?<RefreshCcw/);
  assert.match(source, /ActionButton label="Rewind"[\s\S]*?<History/);
  assert.doesNotMatch(source, /RefreshCcw className="[^"]*rotate-90/);
});

test("tablet message frames retain a circular avatar", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  assert.match(source, /CharacterAvatar/);
  assert.match(source, /rounded-full/);
  assert.match(source, /xl:hidden/);
});

test("tablet quick panel can stack above its blur overlay", async () => {
  const source = await readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /relative z-10 flex min-h-0 flex-1/);
});

test("chat preview text strips markdown and truncates cleanly", async () => {
  const preview = await import("../src/lib/chat-preview").catch(() => null);
  assert.equal(typeof preview?.toChatPreview, "function");
  assert.equal(preview!.toChatPreview("**Hello** [there](https://example.com)\n`code`", 40), "Hello there code");
  assert.equal(preview!.toChatPreview("A".repeat(50), 10), "AAAAAAAAA…");
});

test("editing a user message truncates later messages atomically", async () => {
  const source = await readFile(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8");
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /deleteMany/);
  assert.match(source, /deletedMessageIds/);
});

test("character previews expose and open the most recent existing chat", async () => {
  const apiSource = await readFile(new URL("../src/app/api/characters/[id]/route.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../src/app/(main)/character/[id]/page.tsx", import.meta.url), "utf8");

  assert.match(apiSource, /recentChat/);
  assert.match(apiSource, /lastActiveAt: "desc"/);
  assert.match(pageSource, /Continue chat/);
  assert.match(pageSource, /recentChat\.id/);
});
