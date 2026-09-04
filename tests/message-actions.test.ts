import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canEditMessageRole,
  conversationBranchThroughMessage,
  continuationClientRequestId,
  latestAssistantVariantGroup,
  partitionMessagesForRewind,
  prepareContinuationTurn,
  prepareRegenerationTurn,
  prepareUserRetryTurn,
  resolveVariantSelection,
  selectPersistedConversationBranch,
  skipTimeClientRequestId,
  skipTimeDurationFromClientRequestId,
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

test("a newly streamed regeneration automatically selects the latest attempt", () => {
  assert.equal(resolveVariantSelection(undefined, undefined, 2), 1);
  assert.equal(resolveVariantSelection(0, 2, 2), 0);
  assert.equal(resolveVariantSelection(1, 2, 3), 2);
  assert.equal(resolveVariantSelection(2, 3, 4), 3);
  assert.equal(resolveVariantSelection(undefined, undefined, 4, 2), 2);
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

test("retry targets only the latest unanswered user turn", () => {
  const unanswered = [
    { id: "u1", role: "USER" as const, content: "First request" },
    { id: "a1", role: "ASSISTANT" as const, content: "First response" },
    { id: "u2", role: "USER" as const, content: "Try this again" }
  ];

  const retry = prepareUserRetryTurn(unanswered, "u2");
  assert.equal(retry?.currentMessage, "Try this again");
  assert.deepEqual(retry?.recentMessages.map((message) => message.id), ["u1", "a1"]);
  assert.equal(prepareUserRetryTurn(unanswered, "u1"), null);
  assert.equal(
    prepareUserRetryTurn([...unanswered, { id: "a2", role: "ASSISTANT" as const, content: "Already answered" }], "u2"),
    null
  );
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

test("regenerating a skip-time response preserves the skip-time action", () => {
  const opening = { id: "a1", role: "ASSISTANT" as const, content: "Welcome to the paddock." };
  const skipTime = {
    id: "a2",
    role: "ASSISTANT" as const,
    content: "Three weeks later, the team returns to the circuit.",
    clientRequestId: skipTimeClientRequestId("request-1", opening.id, { value: 6, unit: "hour" }),
    branchSourceMessageId: opening.id
  };
  const skipTimeVariant = {
    id: "a3",
    role: "ASSISTANT" as const,
    content: "By the following race weekend, the paddock has changed."
  };

  const firstAttempt = prepareRegenerationTurn([opening, skipTime], skipTime.id);
  const regeneratedAttempt = prepareRegenerationTurn([opening, skipTime, skipTimeVariant], skipTimeVariant.id);

  assert.equal(firstAttempt?.trigger, "skip-time");
  assert.deepEqual(firstAttempt?.skipTimeDuration, { value: 6, unit: "hour" });
  assert.equal(regeneratedAttempt?.trigger, "skip-time");
  assert.deepEqual(regeneratedAttempt?.skipTimeDuration, { value: 6, unit: "hour" });
  assert.deepEqual(regeneratedAttempt?.recentMessages.map((message) => message.id), ["a1"]);
  assert.deepEqual(latestAssistantVariantGroup([opening, skipTime, skipTimeVariant]).map((message) => message.id), ["a2", "a3"]);
});

test("skip-time request ids retain custom durations without changing their branch source", () => {
  const requestId = skipTimeClientRequestId("request-2", "assistant-1", { value: 1, unit: "minute" });

  assert.deepEqual(skipTimeDurationFromClientRequestId(requestId), { value: 1, unit: "minute" });
});

test("continuation follows the selected response from the latest regeneration group", () => {
  const conversation = [
    { id: "u1", role: "USER" as const, content: "Open the archive." },
    { id: "a1", role: "ASSISTANT" as const, content: "First response." },
    { id: "a2", role: "ASSISTANT" as const, content: "Second response." },
    { id: "a3", role: "ASSISTANT" as const, content: "Third response." }
  ];

  const selectedBranch = prepareContinuationTurn(conversation, "a2");
  assert.deepEqual(selectedBranch?.map((message) => message.id), ["u1", "a2"]);
  assert.equal(prepareContinuationTurn(conversation, "a1")?.at(-1)?.content, "First response.");
  assert.equal(prepareContinuationTurn(conversation, "missing"), null);
});

test("a new chat branch keeps only the selected regeneration and its canonical ancestry", () => {
  const conversation = [
    { id: "u1", role: "USER" as const, content: "Choose a door." },
    { id: "a1", role: "ASSISTANT" as const, content: "The red door opens." },
    { id: "a2", role: "ASSISTANT" as const, content: "The blue door opens." },
    { id: "a3", role: "ASSISTANT" as const, content: "The black door opens." },
    { id: "u2", role: "USER" as const, content: "Step through the blue door.", branchSourceMessageId: "a2" },
    { id: "a4", role: "ASSISTANT" as const, content: "Cold air spills out." }
  ];

  assert.deepEqual(
    conversationBranchThroughMessage(conversation, "a2")?.map((message) => message.id),
    ["u1", "a2"]
  );
  assert.deepEqual(
    conversationBranchThroughMessage(conversation, "a4")?.map((message) => message.id),
    ["u1", "a2", "u2", "a4"]
  );
});

test("active response selection moves to the latest assistant turn", () => {
  const conversation = [
    { id: "u1", role: "USER" as const, content: "Open the archive." },
    { id: "a1", role: "ASSISTANT" as const, content: "The red door opens." },
    { id: "a2", role: "ASSISTANT" as const, content: "The blue door opens." },
    { id: "u2", role: "USER" as const, content: "Step inside." },
    { id: "a3", role: "ASSISTANT" as const, content: "Cold air spills out." }
  ];

  assert.deepEqual(latestAssistantVariantGroup(conversation).map((message) => message.id), ["a3"]);
  assert.deepEqual(
    latestAssistantVariantGroup([
      ...conversation,
      { id: "a4", role: "ASSISTANT" as const, content: "A lantern flickers." }
    ]).map((message) => message.id),
    ["a3", "a4"]
  );
  assert.deepEqual(
    latestAssistantVariantGroup([
      ...conversation,
      { id: "a4", role: "ASSISTANT" as const, content: "A lantern flickers.", clientRequestId: "continue-request-2" }
    ]).map((message) => message.id),
    ["a4"]
  );
});

test("persisted continuations keep the selected regeneration as the canonical branch", () => {
  const conversation = [
    { id: "u1", role: "USER" as const, content: "Choose a door." },
    { id: "a1", role: "ASSISTANT" as const, content: "The red door opens." },
    { id: "a2", role: "ASSISTANT" as const, content: "The blue door opens." },
    { id: "a3", role: "ASSISTANT" as const, content: "The black door opens." },
    { id: "a4", role: "ASSISTANT" as const, content: "Cold air spills out.", clientRequestId: continuationClientRequestId("request-1", "a2") },
    { id: "u2", role: "USER" as const, content: "Step inside." }
  ];

  assert.deepEqual(selectPersistedConversationBranch(conversation).map((message) => message.id), ["u1", "a2", "a4", "u2"]);
});

test("stream validation permits empty text only for assistant-only, regenerate, and retry actions", () => {
  assert.equal(streamMessageSchema.safeParse({ message: "" }).success, false);
  assert.equal(streamMessageSchema.safeParse({ message: "", continueChat: true }).success, true);
  assert.equal(streamMessageSchema.safeParse({ message: "", skipTime: true }).success, true);
  assert.equal(streamMessageSchema.safeParse({ message: "", skipTime: true, skipTimeValue: 1, skipTimeUnit: "minute" }).success, true);
  assert.equal(streamMessageSchema.safeParse({ message: "", skipTime: true, skipTimeValue: 0, skipTimeUnit: "minute" }).success, false);
  assert.equal(streamMessageSchema.safeParse({ message: "", skipTime: true, skipTimeValue: 5 }).success, false);
  assert.equal(
    streamMessageSchema.safeParse({ message: "", regenerate: true, regenerateMessageId: "assistant-message" }).success,
    true
  );
  assert.equal(streamMessageSchema.safeParse({ message: "", retryUserMessageId: "user-message" }).success, true);
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
  assert.match(rewind, /error\.code === "P2034"/);
  assert.match(hook, /cache: "no-store"/);
  assert.match(hook, /await refreshMessages\(\)/);
  assert.match(rewind, /tx\.memory\.deleteMany/);
  assert.doesNotMatch(rewind, /pinned:\s*false/);
  assert.match(rewind, /tx\.storyTurn\.deleteMany/);
  assert.match(rewind, /tx\.storyFact\.deleteMany/);
  assert.match(rewind, /summary/);
  assert.match(schema, /sourceMessage\s+Message\?.*MemorySourceMessage/);
  assert.match(memory, /latestAssistantMessageId/);
});
