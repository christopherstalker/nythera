import assert from "node:assert/strict";
import test from "node:test";
import { hasTextOutput, isTextChatModel } from "../src/lib/chat-model-capabilities";
import { modelSuggestionsForProvider } from "../src/lib/provider-model-options";

test("catalog excludes non-chat endpoints while retaining instruction-tuned chat models", () => {
  for (const model of [
    "whisper-1",
    "sora-2",
    "omni-moderation-latest",
    "text-embedding-3-small",
    "gpt-4o-realtime-preview",
    "gpt-3.5-turbo-instruct"
  ]) {
    assert.equal(isTextChatModel(model), false, model);
  }
  for (const model of [
    "gpt-4.1",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "openrouter/auto",
    "claude-sonnet-4-20250514"
  ]) {
    assert.equal(isTextChatModel(model), true, model);
  }
  assert.equal(hasTextOutput({ architecture: { output_modalities: ["image"] } }), false);
  assert.equal(hasTextOutput({ architecture: { output_modalities: ["text", "image"] } }), true);
});

test("saved defaults and cached discovery cannot reintroduce non-chat models", () => {
  assert.deepEqual(modelSuggestionsForProvider("custom", "whisper-1", ["sora-2", "chat-model", "chat-model"]), [
    "chat-model"
  ]);
});
