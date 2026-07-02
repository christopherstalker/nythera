import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("flat surface treatment is scoped to the product surfaces", async () => {
  const [globals, sidePanel, characterForm, characterCard] = await Promise.all([
    read("../src/app/globals.css"),
    read("../src/components/panel/SidePanel.tsx"),
    read("../src/components/characters/character-form.tsx"),
    read("../src/components/characters/CharacterCard.tsx")
  ]);

  assert.match(sidePanel, /side-panel/);
  assert.match(sidePanel, /glass-grain/);
  assert.match(characterForm, /character-editor-surfaces/);
  assert.match(characterCard, /absolute inset-0 h-full w-full object-cover/);
  assert.doesNotMatch(characterCard, /glass-depth-card/);
  assert.match(globals, /\.side-panel/);
  assert.match(globals, /\.character-editor-surfaces \.glass-panel/);
  assert.match(globals, /\.glass-depth-card/);
  assert.doesNotMatch(globals, /\.glass-panel\s*\{[^}]*backdrop-filter:\s*blur/s);
  assert.doesNotMatch(globals, /\.glass-depth-card::after[\s\S]*noise\.svg/s);
});

test("flat accessibility surfaces avoid blur, grain, and glow effects", async () => {
  const globals = await read("../src/app/globals.css");

  for (const selector of [".glass-input", ".modal-backdrop"]) {
    const block = globals.match(new RegExp(`${selector.replace(".", "\\.")}[\\s\\S]*?\\n  \\}`))?.[0] ?? "";
    assert.ok(block, `missing ${selector} block`);
    assert.match(block, /backdrop-filter:\s*none/);
    assert.doesNotMatch(block, /backdrop-filter:\s*blur/);
  }
  assert.match(globals, /@media \(min-width:\s*768px\) and \(max-width:\s*1180px\)[\s\S]*\.quick-panel,[\s\S]*\.side-panel,[\s\S]*\.composer-dock[\s\S]*backdrop-filter:\s*none/);
  assert.doesNotMatch(globals, /url\("\/textures\/noise\.svg"\)/);
  assert.doesNotMatch(globals, /box-shadow:\s*0 0 (?:20|32|42|74|84)px/);
});

test("side panel uses a runtime tablet fallback before applying desktop blur", async () => {
  const sidePanel = await read("../src/components/panel/SidePanel.tsx");

  assert.match(sidePanel, /useTabletGlassFallback/);
  assert.match(sidePanel, /\(min-width: 768px\) and \(max-width: 1024px\)/);
  assert.match(sidePanel, /background:\s*isTablet \? "var\(--bg-surface\)" : "color-mix\(in oklch, var\(--bg-surface\) 72%, transparent\)"/);
  assert.match(sidePanel, /backdropFilter:\s*isTablet \? "none" : "blur\(20px\) saturate\(180%\)"/);
});
