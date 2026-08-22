import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mobileStreamMessageSchema } from "../src/lib/validation";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("password registration stays unverified and duplicate identities return a conflict", async () => {
  const [webRegistration, mobileRegistration, mobileAuth] = await Promise.all([
    read("../src/app/api/auth/register/route.ts"),
    read("../src/app/api/mobile/auth/register/route.ts"),
    read("../src/lib/mobile-auth.ts")
  ]);

  assert.match(webRegistration, /PrismaClientKnownRequestError/);
  assert.match(webRegistration, /error\.code === "P2002"/);
  assert.match(webRegistration, /HttpError\(409/);
  assert.doesNotMatch(mobileRegistration, /emailVerified:\s*new Date/);
  assert.match(mobileAuth, /const existing = await tx\.user\.findUnique/);
  assert.match(mobileAuth, /before linking Google/);
  assert.doesNotMatch(mobileAuth, /existing\s*\?\?\s*await tx\.user\.create/);
});

test("CSP permits direct Blob uploads and custom Blob fonts", async () => {
  const config = await read("../next.config.mjs");

  assert.match(config, /font-src 'self' data: https:\/\/\*\.blob\.vercel-storage\.com/);
  assert.match(config, /connect-src 'self'[\s\S]*https:\/\/\*\.blob\.vercel-storage\.com/);
});

test("custom prompts receive facts but no built-in behavioral contracts", async () => {
  const [assembly, memoryPrompt, physicalContinuity, storyFoundation] = await Promise.all([
    read("../src/lib/prompt-assembly.ts"),
    read("../src/lib/prompts/externalSystemPrompt.ts"),
    read("../src/lib/physical-continuity.ts"),
    read("../src/lib/stories/story-foundation.ts")
  ]);

  assert.match(assembly, /const factsOnly = Boolean\(customPromptLayer\)/);
  assert.match(assembly, /factsOnly \? null : buildAdultRoleplayPolicyLayer/);
  assert.match(assembly, /factsOnly \? input\.factualStoryContext : input\.storyContext/);
  assert.match(assembly, /const behaviorLayers = customPromptLayer\s*\? \[customPromptLayer\]\s*: \[roleplayEngineLayer, modeLayer\]/);
  assert.match(assembly, /if \(factsOnly\) \{\s*return \["PLAYER PERSONA \(FACTUAL CONTEXT\)"/);
  assert.match(assembly, /return \[\s*"PLAYER PERSONA — REFERENCE ONLY"[\s\S]*Preserve the profile's facts, never its prose/);
  assert.match(assembly, /if \(factsOnly\) \{\s*return \["STRUCTURED STORY FACTS"/);
  assert.doesNotMatch(memoryPrompt, /ADULT INTIMACY|guide style|preserves continuity/i);
  assert.match(physicalContinuity, /factsOnly/);
  assert.match(storyFoundation, /factualText/);
});

test("custom prompts keep their configured sampling and room prompt precedence", async () => {
  const [webRoute, mobileRoute, rooms] = await Promise.all([
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts"),
    read("../src/lib/rooms.ts")
  ]);

  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /customPromptActive \? effectiveSettings\.temperature : modeTemperature/);
    assert.match(route, /factualStoryContext: storyContext\.factualText/);
  }
  assert.match(mobileRoute, /temporaryPersona: true/);
  assert.match(mobileRoute, /chat\.temporaryPersona \?\? chat\.persona \?\? defaultUserPersona/);
  assert.match(mobileRoute, /translationLanguage: chat\.translationLanguage/);
  assert.match(rooms, /responsePrompt: room\.responsePrompt\?\.trim\(\) \|\| null/);
  assert.match(rooms, /modeContext: buildGroupRoomRules/);
  assert.doesNotMatch(rooms, /buildRoomResponsePrompt/);
});

test("mobile messages reject operations the endpoint does not implement", () => {
  const unsupportedPayloads = [
    { message: "hello", regenerate: true },
    { message: "hello", retryUserMessageId: "message-1" },
    { message: "hello", attachmentIds: ["clh3am8t00000t6d8x7coc4k8"] },
    { message: "hello", continueMessageId: "message-1" },
    { message: "hello", branchMessageId: "message-1" }
  ];

  for (const payload of unsupportedPayloads) {
    assert.equal(mobileStreamMessageSchema.safeParse(payload).success, false);
  }
  assert.equal(mobileStreamMessageSchema.safeParse({ message: "hello" }).success, true);
  assert.equal(mobileStreamMessageSchema.safeParse({ continueChat: true }).success, true);
});
