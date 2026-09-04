import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("message toolbar keeps primary actions legible and moves secondary actions into More", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");

  assert.match(source, /SendHorizontal/);
  assert.match(source, /ActionButton label="Continue"[\s\S]*?<SendHorizontal/);
  assert.match(source, /ActionButton label="Try another"[\s\S]*?<RefreshCw/);
  assert.match(source, /ActionButton label="More"[\s\S]*?<MoreHorizontal/);
  assert.match(source, /onRewind=\{onRewind \? \(\) => onRewind\(id\) : undefined\}/);
  assert.doesNotMatch(source, /RefreshCw className="[^"]*rotate-90/);
});

test("editorial message frames keep speaker identity attached to the manuscript stream", async () => {
  const source = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  assert.match(source, /<Avatar/);
  assert.match(source, /characterAvatarUrl/);
  assert.match(source, /personaAvatarUrl/);
  assert.match(source, /grid-cols-\[42px_minmax\(0,1fr\)\]/);
  assert.match(source, /border-b border-\[var\(--codex-rule\)\]/);
  assert.match(source, /chat-message-content relative max-w-\[760px\]/);
  assert.doesNotMatch(source, /rounded-\[28px\]/);
});

test("chat content stacks above the customizable media background", async () => {
  const source = await readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8");
  assert.match(source, /relative z-10 flex min-h-0 flex-1/);
  assert.match(source, /<ChatBackdrop/);
});

test("double click reading mode hides chat chrome without swallowing interactive controls", async () => {
  const [clientSource, listSource] = await Promise.all([
    readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8")
  ]);

  assert.match(clientSource, /onDoubleClick=\{handleDoubleClick\}/);
  assert.match(clientSource, /onPointerUp=\{handlePointerUp\}/);
  assert.match(clientSource, /className=\{readingMode \? "hidden" : "contents"\}[\s\S]*?<ChatHeader/);
  assert.match(clientSource, /className=\{readingMode \? "hidden" : "contents"\}[\s\S]*?<ChatInput/);
  assert.match(clientSource, /touch-manipulation/);
  assert.match(clientSource, /a, button, input, textarea, select, option/);
  assert.match(clientSource, /event\.key === "Escape"/);
  assert.match(listSource, /hasSoundtrack \|\| readingMode/);
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

test("a delivered or partially delivered reply is not mislabeled as a send failure", async () => {
  const hookSource = await readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8");

  assert.match(hookSource, /assistantContentReceived/);
  assert.match(hookSource, /assistantMessageReceived/);
  assert.match(hookSource, /The reply may have ended early, but the delivered text was saved/);
  assert.match(hookSource, /requestAccepted && assistantContentReceived/);
});

test("streaming batches response deltas before updating the message list", async () => {
  const hookSource = await readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8");

  assert.match(hookSource, /CHAT_STREAM_RENDER_INTERVAL_MS = 40/);
  assert.match(hookSource, /pendingAssistantText \+= text/);
  assert.match(hookSource, /queueAssistantText\(payload\.text\)/);
  assert.match(hookSource, /flushAssistantText\(\)/);
});

test("streaming response variants do not persist the active branch on every render", async () => {
  const [clientSource, listSource] = await Promise.all([
    readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8")
  ]);

  assert.match(clientSource, /const latestAssistantId = useMemo/);
  assert.match(clientSource, /\}, \[latestAssistantId\]\);/);
  assert.doesNotMatch(listSource, /if \(selected\) onActiveVariantChange/);
  assert.match(listSource, /onActiveVariantChange\?\.\(group\.variants\[nextIndex\]\.id\)/);
  assert.match(clientSource, /ACTIVE_VARIANT_SAVE_DEBOUNCE_MS = 500/);
  assert.match(clientSource, /persistedActiveAssistantMessageIdRef\.current === messageId/);
  assert.match(clientSource, /activeVariantSaveAbortRef\.current\?\.abort\(\)/);
});

test("chat refresh ignores overlapping requests", async () => {
  const hookSource = await readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8");

  assert.match(hookSource, /if \(refreshInFlightRef\.current\)/);
  assert.match(hookSource, /refreshInFlightRef\.current = true/);
  assert.match(hookSource, /refreshInFlightRef\.current = false/);
});

test("repeated active-version saves are idempotent at the API boundary", async () => {
  const routeSource = await readFile(new URL("../src/app/api/chats/[id]/route.ts", import.meta.url), "utf8");

  assert.match(routeSource, /const isActiveSelectionOnly/);
  assert.match(routeSource, /chat\.activeAssistantMessageId === input\.activeAssistantMessageId/);
  assert.match(routeSource, /return json\(\{ chat \}\)/);
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
  assert.match(hookSource, /!isAssistantAction && !isRegeneration/);
  assert.match(validationSource, /regenerateMessageId: z\.string\(\)/);
  assert.match(streamSource, /prepareRegenerationTurn\(recentMessages, input\.regenerateMessageId\)/);
});

test("an earlier selected regeneration keeps continue and regenerate actions", async () => {
  const [clientSource, listSource, streamSource, promptSource] = await Promise.all([
    readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8")
  ]);

  assert.match(listSource, /onRegenerate=\{isLatestVariantGroup \? onRegenerate : undefined\}/);
  assert.match(listSource, /onContinue=\{isLatestVariantGroup \? onContinue : undefined\}/);
  assert.match(clientSource, /continueMessageId: assistantMessageId/);
  assert.match(streamSource, /prepareContinuationTurn\(recentMessages, input\.continueMessageId\)/);
  assert.match(streamSource, /branchInstruction = `The selected response quoted below/);
  assert.match(streamSource, /continuationClientRequestId/);
  assert.doesNotMatch(streamSource, /Continue the roleplay naturally from the latest message/);
  assert.match(promptSource, /SELECTED CONVERSATION BRANCH \(AUTHORITATIVE\)/);
});

test("chat header exposes an explicit no-cache refresh action", async () => {
  const [headerSource, hookSource] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8")
  ]);

  assert.match(headerSource, /ariaLabel=\{refreshing \? "Refreshing chat" : "Refresh chat"\}/);
  assert.match(hookSource, /\?refresh=\$\{Date\.now\(\)\}/);
  assert.match(hookSource, /cache: "no-store"/);
  assert.match(hookSource, /messagesRef\.current = refreshedMessages/);
});

test("regeneration attempt controls sit below the post and rendered copy is selection-locked", async () => {
  const [listSource, bubbleSource, menuSource, styles] = await Promise.all([
    readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageContextMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(listSource, /resolveVariantSelection/);
  assert.match(listSource, /variantCountByGroupRef/);
  assert.match(bubbleSource, /chat-message-copy-locked/);
  assert.match(bubbleSource, /Version \$\{variantIndex! \+ 1\} of \$\{variantCount\}/);
  assert.doesNotMatch(menuSource, /Previous attempt|Next attempt/);
  assert.match(styles, /\.chat-message-copy-locked\s*\{[\s\S]*?-webkit-touch-callout: none;[\s\S]*?user-select: none;/);
});

test("latest message actions do not expose a no-op rewind", async () => {
  const [listSource, bubbleSource] = await Promise.all([
    readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8")
  ]);

  assert.match(listSource, /onRewind=\{!isLatestMessage \? onRewind : undefined\}/);
  assert.match(bubbleSource, /onRewind=\{onRewind \? \(\) => onRewind\(id\) : undefined\}/);
  assert.doesNotMatch(bubbleSource, /ActionButton label="Rewind"/);
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

test("character profiles expose separate continue and new-chat actions", async () => {
  const apiSource = await readFile(new URL("../src/app/api/characters/[id]/route.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../src/components/character/character-profile-client.tsx", import.meta.url), "utf8");

  assert.match(apiSource, /recentChat/);
  assert.match(apiSource, /lastActiveAt: "desc"/);
  assert.match(pageSource, /Continue chat/);
  assert.match(pageSource, /Start new chat/);
  assert.match(pageSource, /recentChat\.id/);
  assert.match(pageSource, /async function createChat/);
  assert.match(pageSource, /function continueChat/);
});
