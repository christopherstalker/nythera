import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMemoryRetrievalQuery,
  completedConversationTurns,
  conversationSummaryIsStale,
  shouldCaptureContext,
  shouldRefreshConversationSummary,
  shouldRunDeepMemoryExtraction
} from "../src/lib/memory-policy";

test("background memory work does not spend a second model request on every chat turn", async () => {
  const memory = await readFile(new URL("../src/lib/memory.ts", import.meta.url), "utf8");

  assert.equal(completedConversationTurns(1), 0);
  assert.equal(completedConversationTurns(7), 3);
  assert.equal(shouldCaptureContext(7), true);
  assert.equal(shouldCaptureContext(9), false);
  assert.equal(shouldRunDeepMemoryExtraction(13), true);
  assert.equal(shouldRunDeepMemoryExtraction(15), false);
  assert.match(memory, /shouldRunDeepExtraction && input\.providerKeys\?\.length/);
});

test("conversation summaries refresh on reachable completed-turn counts and repair meaningful lag", () => {
  assert.equal(shouldRefreshConversationSummary(37), true);
  assert.equal(shouldRefreshConversationSummary(39), false);
  assert.equal(conversationSummaryIsStale({ messageCount: 33, summaryThroughSequence: 0 }), true);
  assert.equal(conversationSummaryIsStale({ messageCount: 35, summaryThroughSequence: 9 }), false);
});

test("memory retrieval includes recent scene context for short follow-up messages", () => {
  const query = buildMemoryRetrievalQuery("Okay.", [
    { role: "USER", content: "We promised to meet Mara at the old observatory after midnight." },
    { role: "ASSISTANT", content: "I pocket the brass key and agree to keep the map secret." }
  ]);

  assert.match(query, /^Okay\./);
  assert.match(query, /brass key/);
  assert.match(query, /old observatory/);
  assert.ok(query.length <= 4_000);
});
