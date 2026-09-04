import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("custom prompt replaces built-in behavior while platform safety remains authoritative", async () => {
  const responsePrompt = await import("../src/lib/response-prompt").catch(() => null);
  assert.ok(responsePrompt, "response prompt support is missing");
  const selected = responsePrompt.selectCustomPrompt(
    "Write in first person with short dialogue-led replies.",
    "Character-level fallback"
  );
  assert.ok(selected);
  const layer = responsePrompt.buildResponsePromptLayer(selected);

  assert.equal(selected.source, "chat");
  assert.match(layer, /CUSTOM SYSTEM PROMPT \(CHAT USER — AUTHORITATIVE\)/);
  assert.match(layer, /Platform safety rules remain authoritative/i);
  assert.match(layer, /replaces Nythera's built-in Roleplay Engine and chat-mode style prompt/i);
  assert.match(layer, /Write in first person with short dialogue-led replies\./);
});

test("chat prompt wins over character prompt and blank values fall back cleanly", async () => {
  const responsePrompt = await import("../src/lib/response-prompt").catch(() => null);
  assert.ok(responsePrompt, "response prompt support is missing");

  assert.deepEqual(responsePrompt.selectCustomPrompt("Chat prompt", "Character prompt"), {
    source: "chat",
    prompt: "Chat prompt"
  });
  assert.deepEqual(responsePrompt.selectCustomPrompt("  ", "Character prompt"), {
    source: "character",
    prompt: "Character prompt"
  });
  assert.equal(responsePrompt.selectCustomPrompt("", null), null);
});

test("custom prompt is the final behavioral layer after factual context", async () => {
  const assembly = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");

  assert.match(assembly, /selectCustomPrompt\(input\.responsePrompt, character\.systemPromptOverride\)/);
  assert.match(assembly, /customPromptLayer\s*\? \[customPromptLayer\]\s*:\s*\[roleplayEngineLayer, modeLayer\]/);
});

test("realism mode preserves the selected response size", async () => {
  const realism = await readFile(new URL("../src/lib/prompts/modes/realismMode.ts", import.meta.url), "utf8");

  assert.match(realism, /Obey the selected response-length target exactly/);
  assert.doesNotMatch(realism, /one to three compact paragraphs/i);
});

test("response instruction examples give users concise starting points", async () => {
  const responsePrompt = await import("../src/lib/response-prompt").catch(() => null);
  assert.ok(responsePrompt, "response prompt support is missing");
  assert.deepEqual(responsePrompt.RESPONSE_PROMPT_EXAMPLES.map((example) => example.label), ["Cinematic", "Concise", "Dialogue-led"]);
  assert.ok(responsePrompt.RESPONSE_PROMPT_EXAMPLES.every((example) => example.prompt.length >= 40));
});

test("response instructions are stored and assembled without an arbitrary character limit", async () => {
  const responsePrompt = await import("../src/lib/response-prompt").catch(() => null);
  assert.ok(responsePrompt, "response prompt support is missing");
  const longInstruction = `Keep the scene moving. ${"Use concrete sensory detail. ".repeat(120)}`;

  assert.ok(longInstruction.length > 2000);
  assert.ok(responsePrompt.buildResponsePromptLayer({ source: "chat", prompt: longInstruction }).includes(longInstruction.trim()));
});

test("chat persistence and prompt assembly send response instructions through the proxy message payload", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const validation = await readFile(new URL("../src/lib/validation.ts", import.meta.url), "utf8");
  const assembly = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");
  const streamRoute = await readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8");
  const input = await readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8");

  assert.match(schema, /responsePrompt\s+String\?\s+@db\.Text/);
  assert.match(validation, /responsePrompt:\s*z\.string\(\)\.trim\(\)\.max\(ELEVATED_RESPONSE_PROMPT_LENGTH\)/);
  assert.match(streamRoute, /getChatInputLimits\(user\.id\)/);
  assert.match(assembly, /buildResponsePromptLayer\(customPrompt\)/);
  assert.match(streamRoute, /const responsePrompt = input\.responsePrompt \?\? chat\.responsePrompt/);
  assert.match(streamRoute, /responsePrompt,/);
  assert.match(input, /Custom system prompt/);
  assert.match(input, /RESPONSE_PROMPT_EXAMPLES/);
  assert.match(input, /inputLimits\?\.responsePrompt \?\? MAX_RESPONSE_PROMPT_LENGTH/);
});
