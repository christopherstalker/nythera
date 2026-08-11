import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("the latest user turn can be sent again after API failure or rewind", async () => {
  const [hook, client, list, bubble, actions] = await Promise.all([
    read("../src/hooks/useChat.ts"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/components/chat/MessageList.tsx"),
    read("../src/components/chat/MessageBubble.tsx"),
    read("../src/lib/message-actions.ts")
  ]);

  assert.match(hook, /retryUserMessage/);
  assert.match(hook, /const refreshed = await refreshMessages\(\)/);
  assert.match(hook, /retryUserMessageId: persisted\.id/);
  assert.doesNotMatch(hook, /send\(persisted\.content, \{ \.\.\.options, regenerate: true \}\)/);
  assert.match(hook, /message\.clientRequestId === original\.clientRequestId/);
  assert.match(client, /onRetry=\{retryMessage\}/);
  assert.match(list, /row\.message\.role === "USER" && isLatestMessage/);
  assert.match(bubble, /label="Send again"/);
  assert.match(actions, /lastMessage\.role === "USER"/);
});

test("contextual exchange memory is stored independently of the queue worker", async () => {
  const [memory, stream, mobile] = await Promise.all([
    read("../src/lib/memory.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts")
  ]);

  const contextualWrite = memory.indexOf("storeContextualExchange({ ...jobInput, providerKeys })");
  const queueWrite = memory.indexOf('enqueueJob("extract-memories", jobInput)');
  assert.ok(contextualWrite >= 0 && contextualWrite < queueWrite);
  assert.match(memory, /extractor: "contextual-exchange"/);
  assert.match(memory, /category: MemoryCategory\.EVENT/);
  assert.match(memory, /Earlier scene context:/);
  assert.match(memory, /sourceChatId: input\.chatId/);
  for (const route of [stream, mobile]) {
    assert.match(route, /schedulePostMessageJobs/);
    assert.match(route, /user\.memoryEnabled && !continueChat/);
  }
});
