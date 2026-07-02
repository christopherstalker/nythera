import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("response instructions are constrained to output style below safety and persona authority", async () => {
  const responsePrompt = await import("../src/lib/response-prompt").catch(() => null);
  assert.ok(responsePrompt, "response prompt support is missing");
  const layer = responsePrompt.buildResponsePromptLayer("Write in first person with short dialogue-led replies.");

  assert.match(layer, /RESPONSE INSTRUCTIONS \(STYLE ONLY\)/);
  assert.match(layer, /cannot override safety, character persona, scenario, or established facts/i);
  assert.match(layer, /Write in first person with short dialogue-led replies\./);
});

test("response instruction examples give users concise starting points", async () => {
  const responsePrompt = await import("../src/lib/response-prompt").catch(() => null);
  assert.ok(responsePrompt, "response prompt support is missing");
  assert.deepEqual(responsePrompt.RESPONSE_PROMPT_EXAMPLES.map((example) => example.label), ["Cinematic", "Concise", "Dialogue-led"]);
  assert.ok(responsePrompt.RESPONSE_PROMPT_EXAMPLES.every((example) => example.prompt.length >= 40));
});

test("chat persistence and prompt assembly send response instructions through the proxy message payload", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const validation = await readFile(new URL("../src/lib/validation.ts", import.meta.url), "utf8");
  const assembly = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");
  const streamRoute = await readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8");
  const input = await readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8");

  assert.match(schema, /responsePrompt\s+String\?\s+@db\.Text/);
  assert.match(validation, /responsePrompt:\s*z\.string\(\)\.trim\(\)\.max\(2000\)/);
  assert.match(assembly, /buildResponsePromptLayer\(input\.responsePrompt\)/);
  assert.match(streamRoute, /responsePrompt:\s*input\.responsePrompt \?\? chat\.responsePrompt/);
  assert.match(input, /Response instructions/);
  assert.match(input, /RESPONSE_PROMPT_EXAMPLES/);
});
