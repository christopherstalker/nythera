import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("account settings are split into dedicated routes behind one shared shell", async () => {
  const [layout, shell, sections, overview] = await Promise.all([
    read("../src/app/(main)/settings/layout.tsx"),
    read("../src/components/settings/settings-shell.tsx"),
    read("../src/components/settings/settings-sections.tsx"),
    read("../src/app/(main)/settings/page.tsx")
  ]);

  assert.match(layout, /<SettingsShell>\{children\}<\/SettingsShell>/);
  assert.match(shell, /aria-label="Settings sections"/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shell, /router\.replace\(legacySection\.href\)/);
  assert.doesNotMatch(shell, /PageHeader/);
  assert.match(overview, /<h1[^>]*>Settings<\/h1>/);
  assert.match(overview, /SETTINGS_SECTIONS\.map/);

  for (const route of ["account", "personas", "providers", "voice", "interface", "memory", "help"]) {
    assert.match(sections, new RegExp(`href: "\\/settings\\/${route}"`));
    const page = await read(`../src/app/(main)/settings/${route}/page.tsx`);
    assert.match(page, /SettingsPageHeader/);
  }
});

test("settings responsibilities no longer mount together on the overview page", async () => {
  const [overview, account, personas, providers, voice, memory] = await Promise.all([
    read("../src/app/(main)/settings/page.tsx"),
    read("../src/app/(main)/settings/account/page.tsx"),
    read("../src/app/(main)/settings/personas/page.tsx"),
    read("../src/app/(main)/settings/providers/page.tsx"),
    read("../src/app/(main)/settings/voice/page.tsx"),
    read("../src/app/(main)/settings/memory/page.tsx")
  ]);

  for (const client of ["ProfileSettingsClient", "UserPersonaSettingsClient", "KeySettingsClient", "VoiceKeySettingsClient", "MemorySettingsClient"]) {
    assert.doesNotMatch(overview, new RegExp(client));
  }
  assert.match(account, /ProfileSettingsClient/);
  assert.match(personas, /UserPersonaSettingsClient/);
  assert.match(providers, /KeySettingsClient/);
  assert.match(voice, /VoiceKeySettingsClient/);
  assert.match(memory, /MemorySettingsClient/);
});

test("internal settings links use the new provider and persona routes", async () => {
  const [chatInput, promptGenerator, personaSwitcher, apiGuide] = await Promise.all([
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/components/characters/prompt-generator-panel.tsx"),
    read("../src/components/persona/persona-switcher.tsx"),
    read("../src/app/guide/api/page.tsx")
  ]);
  const source = [chatInput, promptGenerator, personaSwitcher, apiGuide].join("\n");

  assert.doesNotMatch(source, /\/settings#(?:api-keys|persona)/);
  assert.match(source, /\/settings\/providers/);
  assert.match(source, /\/settings\/personas/);
});
