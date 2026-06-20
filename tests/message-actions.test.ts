import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canEditMessageRole,
  partitionMessagesForRewind,
  shouldRegenerateAfterMessageEdit
} from "../src/lib/message-actions";

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

test("message editing is inline and exposed for both roles", async () => {
  const bubble = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(bubble, /window\.prompt\("Edit message"/);
  assert.match(bubble, /aria-label="Edit message text"/);
  assert.match(bubble, /onEdit=\{edit\}/);
});
