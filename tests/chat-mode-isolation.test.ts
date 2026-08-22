import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPromptAddonLayers, modeTemperature } from "../src/lib/prompts/buildPrompt";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("each chat mode compiles one isolated style contract", () => {
  const memory = {
    characterMemories: ["The café closes at ten."],
    userMemories: ["Preference: concise replies"]
  };
  const realism = buildPromptAddonLayers({ mode: "realism", ...memory });
  const fantasy = buildPromptAddonLayers({ mode: "fantasy", ...memory });

  assert.match(realism.modeStyle, /REALISM MODE — AUTHORITATIVE STYLE/);
  assert.doesNotMatch(realism.modeStyle, /FANTASY MODE/);
  assert.match(fantasy.modeStyle, /FANTASY MODE/);
  assert.doesNotMatch(fantasy.modeStyle, /REALISM MODE/);
  assert.match(realism.sessionMemory, /SESSION MEMORY — FACTUAL CONTEXT/);
  assert.match(fantasy.sessionMemory, /SESSION MEMORY — FACTUAL CONTEXT/);
  assert.doesNotMatch(realism.sessionMemory, /preserves continuity|guide style|ADULT INTIMACY/);
  assert.doesNotMatch(fantasy.sessionMemory, /preserves continuity|guide style|ADULT INTIMACY/);
});

test("mode style and session memory remain separate prompt layers", () => {
  const layers = buildPromptAddonLayers({
    mode: "realism",
    characterMemories: ["The café closes at ten."],
    userMemories: ["Preference: concise replies"]
  });

  assert.match(layers.modeStyle, /REALISM MODE/);
  assert.doesNotMatch(layers.modeStyle, /SESSION MEMORY/);
  assert.match(layers.sessionMemory, /SESSION MEMORY — FACTUAL CONTEXT/);
  assert.doesNotMatch(layers.sessionMemory, /REALISM MODE|FANTASY MODE/);
  assert.match(layers.sessionMemory, /The café closes at ten/);
});

test("external prompts exclude every built-in behavior layer while retaining factual memory", async () => {
  const assembly = await read("../src/lib/prompt-assembly.ts");

  assert.match(assembly, /sessionMemoryLayer,[\s\S]*memoryLayer/);
  assert.match(assembly, /const behaviorLayers = customPromptLayer[\s\S]*\? \[customPromptLayer\][\s\S]*: \[roleplayEngineLayer, modeLayer\]/);
  assert.doesNotMatch(assembly, /\? \[modeLayer, customPromptLayer\]/);
});

test("internal modes reject generic model prose without blending their world rules", () => {
  const realism = buildPromptAddonLayers({ mode: "realism", characterMemories: [], userMemories: [] }).modeStyle;
  const fantasy = buildPromptAddonLayers({ mode: "fantasy", characterMemories: [], userMemories: [] }).modeStyle;

  assert.match(realism, /observable consequences/i);
  assert.match(realism, /interchangeable romance choreography/i);
  assert.match(realism, /doesn't step back/i);
  assert.doesNotMatch(realism, /Magic, impossible species|prophecy/);
  assert.match(fantasy, /Fantastic content does not require ornamental prose/i);
  assert.match(fantasy, /Generic fantasy or cinematic filler/i);
  assert.doesNotMatch(fantasy, /Respect ordinary cause and effect|social norms/);
});

test("realism sampling stays restrained while fantasy keeps creative headroom", () => {
  assert.equal(modeTemperature("realism", 1.8), 0.75);
  assert.equal(modeTemperature("realism", 0.1), 0.35);
  assert.equal(modeTemperature("fantasy", 0.2), 0.85);
  assert.equal(modeTemperature("fantasy", 1.8), 1.15);
});

test("persona authorship and post-response work are protected at the prompt and route boundaries", async () => {
  const [assembly, webRoute, mobileRoute, postResponse, sequences] = await Promise.all([
    read("../src/lib/prompt-assembly.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts"),
    read("../src/lib/post-response.ts"),
    read("../src/lib/message-sequence.ts")
  ]);

  assert.match(assembly, /PLAYER PERSONA — REFERENCE ONLY/);
  assert.match(assembly, /Do not repeatedly notice, inventory, praise, fetishize/);
  assert.match(assembly, /Preserve the profile's facts, never its prose/);
  assert.match(assembly, /Do not quote, closely paraphrase, echo, enumerate/);
  assert.match(assembly, /immediate scene-specific consequence in fresh language/);
  assert.match(assembly, /Build reactions from the character's immediate objective/);
  assert.match(assembly, /replace every generic gesture, metaphor, and dramatic transition/);
  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /buildPromptAddonLayers/);
    assert.match(route, /sessionMemoryContext: promptAddon\.sessionMemory/);
    assert.match(route, /schedulePostResponseTasks/);
    assert.doesNotMatch(route, /prompt\[0\]\.content\s*=/);
  }
  assert.match(postResponse, /Promise\.allSettled/);
  assert.match(sequences, /pg_advisory_xact_lock/);
  assert.match(sequences, /pg_advisory_xact_lock\([^;]+\)::text AS lock_result/g);
});
