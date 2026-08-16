import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { moderateText } from "../src/lib/safety";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("consenting-adult explicit content is allowed while minor and non-consensual content stays blocked", () => {
  assert.equal(moderateText({ text: "Kiss me", userIsMinor: false, context: "message" }).allowed, true);
  assert.equal(moderateText({ text: "A consensual romantic scene", userIsMinor: false, context: "message" }).allowed, true);
  assert.equal(moderateText({ text: "Explicit sex between consenting adults", userIsMinor: false, context: "message" }).allowed, true);
  assert.equal(moderateText({ text: "Adult porn scene", userIsMinor: false, context: "assistant" }).allowed, true);
  assert.equal(moderateText({ text: "Kiss me", userIsMinor: true, context: "message" }).allowed, false);
  assert.equal(moderateText({ text: "Non-consensual sex", userIsMinor: false, context: "message" }).allowed, false);
});

test("prompts support in-character adult romance without weakening hard safety boundaries", async () => {
  const [externalPrompt, fantasyPrompt, assembly] = await Promise.all([
    read("../src/lib/prompts/externalSystemPrompt.ts"),
    read("../src/lib/prompts/modes/fantasyMode.ts"),
    read("../src/lib/prompt-assembly.ts")
  ]);

  assert.match(externalPrompt, /ADULT INTIMACY/);
  assert.match(externalPrompt, /consenting adults/i);
  assert.match(externalPrompt, /explicit sexual content/i);
  assert.match(externalPrompt, /Do not censor, soften, or fade to black/i);
  assert.match(externalPrompt, /Never sexualize minors/i);
  assert.match(fantasyPrompt, /consensual-adult intimacy/i);
  assert.match(assembly, /romantic, sexual, or explicit/i);
});

test("custom chat and profile fonts upload to durable storage and load through FontFace", async () => {
  const [fontHook, uploadRoute, chatEditor, chatClient, accountEditor, publicProfile] = await Promise.all([
    read("../src/hooks/use-custom-font.ts"),
    read("../src/app/api/fonts/upload/route.ts"),
    read("../src/components/chat/ChatAppearancePanel.tsx"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/components/account/account-hub-client.tsx"),
    read("../src/components/profile/public-profile-view.tsx")
  ]);

  assert.match(fontHook, /new FontFace/);
  assert.match(fontHook, /document\.fonts\.add/);
  assert.match(uploadRoute, /maximumSizeInBytes: MAX_FONT_BYTES/);
  assert.match(uploadRoute, /chat-fonts\/\$\{chatId\}\//);
  assert.match(chatEditor, /Upload custom font/);
  assert.match(chatEditor, /fontInputRef\.current\?\.click\(\)/);
  assert.match(chatEditor, /handleUploadUrl: "\/api\/fonts\/upload"/);
  assert.match(chatClient, /useCustomFontFace\(activeChatAppearance\.fontUrl/);
  assert.match(accountEditor, /profile-fonts\/\$\{safeName\}/);
  assert.match(accountEditor, /fontInputRef\.current\?\.click\(\)/);
  assert.match(publicProfile, /useCustomFontFace\(settings\.fontUrl/);
});
