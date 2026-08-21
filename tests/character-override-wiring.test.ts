import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web and mobile character routes persist model overrides", async () => {
  const mutations = await readFile(new URL("../src/lib/character-mutations.ts", import.meta.url), "utf8");
  assert.match(mutations, /preferredProvider:\s*input\.preferredProvider/);
  assert.match(mutations, /systemPromptOverride:\s*input\.systemPromptOverride/);
  assert.match(mutations, /maxTokens:\s*input\.maxTokens/);

  for (const relativePath of [
    "../src/app/api/characters/route.ts",
    "../src/app/api/mobile/characters/route.ts"
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /createCharacterForUser\(input, user\)/);
  }
});

test("character system instructions replace built-in behavior below platform safety", async () => {
  const source = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");
  assert.match(source, /selectCustomPrompt\(input\.responsePrompt, character\.systemPromptOverride\)/);
  assert.match(source, /Platform safety overrides all other instructions/i);
  assert.match(source, /customPromptLayer[\s\S]*\[customPromptLayer\][\s\S]*\[roleplayEngineLayer, modeLayer\]/);
});

test("the Advanced editor exposes provider, model, samplers, and system instructions", async () => {
  const source = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");
  for (const label of [
    "Provider override",
    "Model override",
    "Temperature",
    "Top P",
    "Frequency penalty",
    "Presence penalty",
    "Max tokens",
    "System prompt override"
  ]) {
    assert.match(source, new RegExp(label, "i"));
  }
});
