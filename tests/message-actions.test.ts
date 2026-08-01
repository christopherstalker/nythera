import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canEditMessageRole,
  partitionMessagesForRewind,
  prepareRegenerationTurn,
  shouldRegenerateAfterMessageEdit
} from "../src/lib/message-actions";
import { streamMessageSchema } from "../src/lib/validation";

const messages = [1, 2, 3, 4, 5].map((number) => ({ id: String(number), content: `Message ${number}` }));

test("rewind keeps the selected message and removes only later messages", () => {
  const result = partitionMessagesForRewind(messages, "3");

  assert.deepEqual(result.retained.map((message) => message.id), ["1", "2", "3"]);
  assert.deepEqual(result.removed.map((message) => message.id), ["4", "5"]);
});

test("user and assistant messages are editable, but only user edits regenerate", () => {
  assert.equal(canEditMessageRole("USER"), true);
  assert.equal(canEditMessageRole("ASSISTANT"), true);
  assert.equal(canEditMessageRole("SYSTEM"), false);
  assert.equal(shouldRegenerateAfterMessageEdit("USER"), true);
  assert.equal(shouldRegenerateAfterMessageEdit("ASSISTANT"), false);
});

test("regeneration targets only the latest assistant variant group without duplicating the user turn", () => {
  const conversation = [
    { id: "u1", role: "USER" as const, content: "Open the archive." },
    { id: "a1", role: "ASSISTANT" as const, content: "The lock gives way." },
    { id: "u2", role: "USER" as const, content: "Read the final page." },
    { id: "a2", role: "ASSISTANT" as const, content: "The ink begins to move." },
    { id: "a3", role: "ASSISTANT" as const, content: "A name rises from the page." }
  ];

  const result = prepareRegenerationTurn(conversation, "a2");
  assert.equal(result?.trigger, "user");
  assert.equal(result?.currentMessage, "Read the final page.");
  assert.deepEqual(result?.recentMessages.map((message) => message.id), ["u1", "a1"]);
  assert.equal(prepareRegenerationTurn(conversation, "a1"), null);
});

test("regeneration after a user edit removes the edited turn from recent context", () => {
  const result = prepareRegenerationTurn([
    { id: "u1", role: "USER" as const, content: "Old context" },
    { id: "a1", role: "ASSISTANT" as const, content: "Old answer" },
    { id: "u2", role: "USER" as const, content: "Edited request" }
  ]);

  assert.equal(result?.currentMessage, "Edited request");
  assert.deepEqual(result?.recentMessages.map((message) => message.id), ["u1", "a1"]);
});

test("regeneration supports opening and continued assistant-only turns", () => {
  const opening = { id: "a1", role: "ASSISTANT" as const, content: "Welcome to the paddock." };
  const continuation = {
    id: "a2",
    role: "ASSISTANT" as const,
    content: "The team principal turns toward you.",
    clientRequestId: "continue-request-1"
  };
  const continuationVariant = {
    id: "a3",
    role: "ASSISTANT" as const,
    content: "The team principal sets down his notes."
  };

  const openingResult = prepareRegenerationTurn([opening], opening.id);
  assert.equal(openingResult?.trigger, "opening");
  assert.deepEqual(openingResult?.recentMessages, []);

  const continuedResult = prepareRegenerationTurn([opening, continuation, continuationVariant], continuation.id);
  assert.equal(continuedResult?.trigger, "continuation");
  assert.deepEqual(continuedResult?.recentMessages.map((message) => message.id), ["a1"]);
});

test("stream validation permits empty text only for continue and regenerate actions", () => {
  assert.equal(streamMessageSchema.safeParse({ message: "" }).success, false);
  assert.equal(streamMessageSchema.safeParse({ message: "", continueChat: true }).success, true);
  assert.equal(
    streamMessageSchema.safeParse({ message: "", regenerate: true, regenerateMessageId: "assistant-message" }).success,
    true
  );
});

test("message editing is inline and exposed for both roles", async () => {
  const bubble = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(bubble, /window\.prompt\("Edit message"/);
  assert.match(bubble, /aria-label="Edit message text"/);
  assert.match(bubble, /onEdit=\{edit\}/);
});

test("rewind uses one server transaction and removes derived future context", async () => {
  const [hook, route, rewind, schema, memory] = await Promise.all([
    readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chats/[id]/rewind/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/chat-rewind.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/memory.ts", import.meta.url), "utf8")
  ]);

  assert.match(hook, /api\/chats\/\$\{chatId\}\/rewind/);
  assert.doesNotMatch(hook, /toDelete[\s\S]*Promise\.all/);
  assert.match(route, /rewindChat/);
  assert.match(rewind, /TransactionIsolationLevel\.Serializable/);
  assert.match(rewind, /tx\.memory\.deleteMany/);
  assert.match(rewind, /tx\.storyTurn\.deleteMany/);
  assert.match(rewind, /tx\.storyFact\.deleteMany/);
  assert.match(rewind, /summary/);
  assert.match(schema, /sourceMessage\s+Message\?.*MemorySourceMessage/);
  assert.match(memory, /latestAssistantMessageId/);
});
