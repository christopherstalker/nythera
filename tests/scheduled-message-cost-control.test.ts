import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getScheduledMessageDelay } from "../src/lib/scheduled-messages";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("scheduled message checks wait until the next trigger", () => {
  const now = Date.parse("2026-09-01T12:00:00.000Z");

  assert.equal(getScheduledMessageDelay(null, now), null);
  assert.equal(getScheduledMessageDelay("invalid", now), null);
  assert.equal(getScheduledMessageDelay("2026-09-01T12:05:00.000Z", now), 300_000);
  assert.equal(getScheduledMessageDelay("2026-09-01T11:59:00.000Z", now), 1_000);
});

test("chat scheduling does not use a recurring database poll", async () => {
  const [client, route, quickPanel] = await Promise.all([
    read("../src/components/chat/chat-client.tsx"),
    read("../src/app/api/chats/[id]/scheduled/route.ts"),
    read("../src/hooks/use-chat-quick-panel.ts")
  ]);

  assert.doesNotMatch(client, /setInterval\([^)]*checkScheduledMessages/);
  assert.match(client, /getScheduledMessageDelay/);
  assert.match(client, /visibilitychange/);
  assert.match(route, /nextTriggerAt/);
  assert.match(quickPanel, /SCHEDULED_EVENTS_CHANGED_EVENT/);
});
