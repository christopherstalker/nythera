import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("message toolbar uses distinct continue, regenerate, and rewind actions", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");

  assert.match(source, /SendHorizontal/);
  assert.match(source, /ActionButton label="Continue"[\s\S]*?<SendHorizontal/);
  assert.match(source, /ActionButton label="Regenerate"[\s\S]*?<RefreshCw/);
  assert.match(source, /ActionButton label="Rewind"[\s\S]*?<History/);
  assert.doesNotMatch(source, /RefreshCw className="[^"]*rotate-90/);
});

test("immersive message frames keep avatars out of the body stream", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /CharacterAvatar/);
  assert.match(source, /w-full rounded-\[28px\]/);
  assert.match(source, /max-w-\[min\(74%,480px\)\]/);
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

test("message delete removes stale local ghosts and keeps chat counts fresh", async () => {
  const [hookSource, apiSource] = await Promise.all([
    readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8")
  ]);

  assert.match(hookSource, /response\.status === 404/);
  assert.match(hookSource, /current\.filter\(\(message\) => message\.id !== messageId\)/);
  assert.match(apiSource, /messageCount: actualMessageCount/);
});

test("message patch route persists pinned state separately from text edits", async () => {
  const source = await readFile(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8");

  assert.match(source, /pinned: z\.boolean\(\)\.optional\(\)/);
  assert.match(source, /input\.content !== undefined/);
  assert.match(source, /input\.pinned !== undefined \? \{ pinned: input\.pinned \}/);
});

test("character previews expose and open the most recent existing chat", async () => {
  const apiSource = await readFile(new URL("../src/app/api/characters/[id]/route.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../src/app/(main)/character/[id]/page.tsx", import.meta.url), "utf8");

  assert.match(apiSource, /recentChat/);
  assert.match(apiSource, /lastActiveAt: "desc"/);
  assert.match(pageSource, /Continue chat/);
  assert.match(pageSource, /recentChat\.id/);
});
