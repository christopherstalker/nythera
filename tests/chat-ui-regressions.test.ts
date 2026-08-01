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

test("editorial message frames keep speaker identity attached to the manuscript stream", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  assert.match(source, /<Avatar/);
  assert.match(source, /characterAvatarUrl/);
  assert.match(source, /personaAvatarUrl/);
  assert.match(source, /grid-cols-\[42px_minmax\(0,1fr\)\]/);
  assert.match(source, /border-b border-\[var\(--codex-rule\)\]/);
  assert.match(source, /font-editorial relative max-w-\[760px\]/);
  assert.doesNotMatch(source, /rounded-\[28px\]/);
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

test("streamed chat replaces optimistic user messages with persisted ids", async () => {
  const [hookSource, streamSource] = await Promise.all([
    readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8")
  ]);

  assert.match(streamSource, /userMessage = await createMessageWithNextSequence/);
  assert.match(streamSource, /type: "user_message"/);
  assert.match(hookSource, /clientRequestId: requestId/);
  assert.match(hookSource, /payload\.type === "user_message"/);
  assert.match(hookSource, /message\.clientRequestId === requestId/);
});

test("regeneration sends and validates the selected latest assistant id", async () => {
  const [clientSource, hookSource, streamSource, validationSource] = await Promise.all([
    readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/validation.ts", import.meta.url), "utf8")
  ]);

  assert.match(clientSource, /regenerateMessageId: assistantMessageId/);
  assert.match(clientSource, /previousUser\?\.content \?\? ""/);
  assert.match(hookSource, /regenerateMessageId: options\?\.regenerateMessageId/);
  assert.match(hookSource, /!isContinuation && !isRegeneration/);
  assert.match(validationSource, /regenerateMessageId: z\.string\(\)/);
  assert.match(streamSource, /prepareRegenerationTurn\(recentMessages, input\.regenerateMessageId\)/);
});

test("latest message actions do not expose a no-op rewind", async () => {
  const [listSource, bubbleSource] = await Promise.all([
    readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8")
  ]);

  assert.match(listSource, /onRewind=\{!isLatestMessage \? onRewind : undefined\}/);
  assert.match(bubbleSource, /\{onRewind \? \([\s\S]*?ActionButton label="Rewind"/);
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
  const pageSource = await readFile(new URL("../src/components/character/character-profile-client.tsx", import.meta.url), "utf8");

  assert.match(apiSource, /recentChat/);
  assert.match(apiSource, /lastActiveAt: "desc"/);
  assert.match(pageSource, /Continue chat/);
  assert.match(pageSource, /recentChat\.id/);
});
