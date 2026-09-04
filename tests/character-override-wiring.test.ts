import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS } from "../src/lib/prompt-limits";
import { characterCreateSchema } from "../src/lib/validation";

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

test("character system instructions are injected below platform safety", async () => {
  const source = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");
  assert.match(source, /buildCharacterSystemOverrideLayer/);
  assert.match(source, /System safety rules remain authoritative/i);
  assert.match(source, /safetyLayer[\s\S]*characterSystemOverrideLayer[\s\S]*characterContractLayer/);
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

test("character system instructions accept and preserve prompts up to 50,000 characters", async () => {
  const prompt = "x".repeat(MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS);
  const parsed = characterCreateSchema.parse({
    creationMode: "custom",
    name: "Prompt Test",
    description: "A character used to verify prompt limits.",
    personality: "Focused, consistent, observant, and concise.",
    greeting: "Hello.",
    systemPromptOverride: prompt
  });
  const assembly = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");

  assert.equal(parsed.systemPromptOverride, prompt);
  assert.match(assembly, /sanitizePromptContext\(value, MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS\)/);
});
