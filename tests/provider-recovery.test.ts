import assert from "node:assert/strict";
import test from "node:test";
import { providerCircuitKey, selectCircuitAttempts, shortenRetryHistory } from "../src/lib/provider-recovery";
import type { PromptMessage } from "../src/types";

test("provider cooldowns are isolated by credential and model, including replacement keys", () => {
  const identity = { provider: "gemini", model: "model-a", credential: "first", keyId: "saved-key" };
  const original = providerCircuitKey(identity);
  assert.notEqual(original, providerCircuitKey({ ...identity, credential: "replacement" }));
  assert.notEqual(original, providerCircuitKey({ ...identity, model: "model-b" }));
  assert.notEqual(original, providerCircuitKey({ ...identity, keyId: "another-account" }));
  assert.doesNotMatch(original, /first|saved-key/);
});

test("open circuits prefer healthy routes and allow exactly one personal recovery attempt", () => {
  const personal = { key: { source: "user" as const } };
  const fallback = { key: { source: "user" as const } };
  const platform = { key: { source: "platform" as const } };
  assert.deepEqual(selectCircuitAttempts([personal, fallback], [true, false]), [fallback]);
  assert.deepEqual(selectCircuitAttempts([personal, fallback], [true, true]), [personal]);
  assert.deepEqual(selectCircuitAttempts([platform], [true]), []);
});

test("context recovery drops old history without truncating custom instructions or the latest turn", () => {
  const instructions = "Keep these instructions. ".repeat(2500);
  const messages: PromptMessage[] = [
    { role: "system", content: instructions },
    { role: "user", content: "old question" },
    { role: "assistant", content: "old answer" },
    { role: "user", content: "recent question" },
    { role: "assistant", content: "recent answer" },
    { role: "system", content: "Pinned canon" },
    { role: "user", content: "latest message" }
  ];
  const shorter = shortenRetryHistory(messages);
  assert.deepEqual(shorter, [messages[0], ...messages.slice(3)]);
  assert.equal(shorter?.[0].content, instructions);
  assert.equal(messages.length, 7);
  assert.equal(shortenRetryHistory([messages[0], messages[6]]), null);
});
