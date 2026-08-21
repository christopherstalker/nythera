import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("nested chat tools close on outside press and stay mutually exclusive", async () => {
  const source = await readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8");

  assert.match(source, /lookbookPanelRef/);
  assert.match(source, /if \(!apiOpen && !lookbookOpen\) return/);
  assert.match(source, /apiOpen && !apiPanelRef\.current\?\.contains\(target\)/);
  assert.match(source, /lookbookOpen && !lookbookPanelRef\.current\?\.contains\(target\)/);
  assert.match(source, /if \(open\) \{[\s\S]*?setApiOpen\(false\);[\s\S]*?setLookbookOpen\(false\);/);
});

test("mobile story context reserves the dock and safe-area height below its scroll content", async () => {
  const [panel, styles] = await Promise.all([
    readFile(new URL("../src/components/panel/SidePanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(panel, /className="[^"]*side-panel-scroll/);
  assert.match(styles, /\.side-panel-scroll\s*\{[\s\S]*?padding-bottom: calc\(var\(--codex-mobile-dock-height\) \+ env\(safe-area-inset-bottom\) \+ 1rem\) !important;/);
  assert.match(styles, /@media \(min-width: 768px\)\s*\{[\s\S]*?\.side-panel-scroll\s*\{[\s\S]*?padding-bottom: max\(1rem, env\(safe-area-inset-bottom\)\) !important;/);
});

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("scene illustration uses Gemini and current OpenAI image models through BYOK fallback", async () => {
  const [generation, route, composer] = await Promise.all([
    read("../src/lib/scene-image-generation.ts"),
    read("../src/app/api/chats/[id]/scene-image/route.ts"),
    read("../src/components/chat/ChatInput.tsx")
  ]);

  assert.match(generation, /gemini-3\.1-flash-image/);
  assert.match(generation, /generativelanguage\.googleapis\.com\/v1beta\/interactions/);
  assert.match(generation, /GEMINI_IMAGE_MIME_TYPE = "image\/jpeg"/);
  assert.match(generation, /gpt-image-2/);
  assert.match(generation, /\[400, 402, 429\]\.includes\(status\)/);
  assert.match(generation, /hard limit/);
  assert.match(generation, /credits or spending limit are exhausted/);
  assert.match(route, /generateSceneImageWithFallback/);
  assert.match(route, /provider: generated\.provider/);
  assert.doesNotMatch(route, /dall-e-3/);
  assert.match(composer, /attached via \$\{body\.provider/);
});

test("microphone access is allowed for the app origin and reports actionable failures", async () => {
  const [config, composer, desktop] = await Promise.all([
    read("../next.config.mjs"),
    read("../src/components/chat/ChatInput.tsx"),
    read("../desktop/electron/main.cjs")
  ]);

  assert.match(config, /microphone=\(self\)/);
  assert.doesNotMatch(config, /microphone=\(\)/);
  assert.match(composer, /Microphone access was denied/);
  assert.match(composer, /No microphone was found/);
  assert.match(composer, /being used by another app/);
  assert.match(desktop, /setPermissionRequestHandler/);
  assert.match(desktop, /mediaTypes\.includes\("audio"\)/);
});

test("lorebook UX explains parsing, previews triggers, and surfaces active chat matches", async () => {
  const [editor, composer, chatRoute] = await Promise.all([
    read("../src/components/characters/character-form.tsx"),
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/app/api/chats/[id]/route.ts")
  ]);

  assert.match(editor, /How it works/);
  assert.match(editor, /Test triggers/);
  assert.match(editor, /No entries match this sample yet/);
  assert.match(composer, /Lorebook active/);
  assert.match(chatRoute, /lorebook: true/);
});

test("Lookbook explains that saved images attach to one message and stay separate from Lorebook", async () => {
  const [composer, tools] = await Promise.all([
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/components/chat/ChatToolsMenu.tsx")
  ]);

  assert.match(composer, /Lookbook · reusable images/);
  assert.match(composer, /attach it as visual context for your next message/);
  assert.match(composer, /Lookbook never changes the character automatically; Lorebook is the separate keyword-based facts system/);
  assert.match(composer, /Attach next/);
  assert.match(tools, /Reusable images/);
});

test("model and style panel closes on outside press and Escape", async () => {
  const composer = await read("../src/components/chat/ChatInput.tsx");

  assert.match(composer, /apiPanelRef\.current\?\.contains/);
  assert.match(composer, /addEventListener\("pointerdown", closeOnOutsidePress\)/);
  assert.match(composer, /event\.key === "Escape"/);
  assert.match(composer, /aria-label="Model and style"/);
});
