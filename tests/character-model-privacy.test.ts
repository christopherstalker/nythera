import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { redactCharacterModelSettings } from "../src/lib/character-model-settings";

test("public character data never exposes private model or system-prompt settings", () => {
  const redacted = redactCharacterModelSettings({
    id: "character-1",
    name: "Ryan",
    preferredProvider: "groq",
    preferredModel: "private-model",
    temperature: 0.8,
    topP: 0.9,
    frequencyPenalty: 0.2,
    presencePenalty: 0.3,
    maxTokens: 900,
    systemPromptOverride: "Private creator instructions"
  });

  assert.deepEqual(redacted, { id: "character-1", name: "Ryan" });
});

test("web and mobile public character routes redact private model settings", async () => {
  for (const path of [
    "../src/app/api/characters/route.ts",
    "../src/app/api/characters/[id]/route.ts",
    "../src/app/api/mobile/characters/route.ts",
    "../src/app/api/mobile/characters/[id]/route.ts"
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /redactCharacterModelSettings/);
  }
});
