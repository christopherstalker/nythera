import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildFullPromptAddon } from "../src/lib/prompts/buildPrompt";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("each chat mode compiles one isolated style contract", () => {
  const memory = {
    characterMemories: ["The café closes at ten."],
    userMemories: ["Preference: concise replies"]
  };
  const realism = buildFullPromptAddon({ mode: "realism", ...memory });
  const fantasy = buildFullPromptAddon({ mode: "fantasy", ...memory });

  assert.match(realism, /REALISM MODE — AUTHORITATIVE STYLE/);
  assert.doesNotMatch(realism, /FANTASY MODE/);
  assert.match(fantasy, /FANTASY MODE/);
  assert.doesNotMatch(fantasy, /REALISM MODE/);
  assert.match(realism, /Memory preserves continuity; it is not a list of details that must appear/);
  assert.match(fantasy, /Preferences guide style and boundaries/);
});

test("chat modes never override the user's selected temperature", async () => {
  const [webRoute, mobileRoute] = await Promise.all([
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts")
  ]);

  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /const temperature = effectiveSettings\.temperature/);
    assert.doesNotMatch(route, /modeTemperature/);
  }
});

test("persona authorship and post-response work are protected at the prompt and route boundaries", async () => {
  const [assembly, webRoute, mobileRoute, postResponse, sequences] = await Promise.all([
    read("../src/lib/prompt-assembly.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts"),
    read("../src/lib/post-response.ts"),
    read("../src/lib/message-sequence.ts")
  ]);

  assert.match(assembly, /PLAYER PERSONA — AUTHORITATIVE IDENTITY AND BOUNDARIES/);
  assert.match(assembly, /Do not repeatedly notice, inventory, praise, fetishize/);
  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /modeContext/);
    assert.match(route, /schedulePostResponseTasks/);
    assert.doesNotMatch(route, /prompt\[0\]\.content\s*=/);
  }
  assert.match(postResponse, /Promise\.allSettled/);
  assert.match(sequences, /pg_advisory_xact_lock/);
  assert.match(sequences, /pg_advisory_xact_lock\([^;]+\)::text AS lock_result/g);
});
