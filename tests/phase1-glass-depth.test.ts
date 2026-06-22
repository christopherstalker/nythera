import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Phase 1 glass depth is scoped to the requested product surfaces", async () => {
  const [globals, quickPanel, characterForm, characterCard] = await Promise.all([
    read("../src/app/globals.css"),
    read("../src/components/chat/chat-quick-panel.tsx"),
    read("../src/components/characters/character-form.tsx"),
    read("../src/components/characters/CharacterCard.tsx")
  ]);

  assert.match(quickPanel, /glass-depth-panel/);
  assert.match(characterForm, /character-editor-surfaces/);
  assert.match(characterCard, /glass-depth-card/);
  assert.match(globals, /\.glass-depth-panel/);
  assert.match(globals, /\.character-editor-surfaces \.glass-panel/);
  assert.match(globals, /\.glass-depth-card/);
  assert.doesNotMatch(globals, /\.glass-panel\s*\{[^}]*noise\.svg/s);
});

test("Phase 1 glass uses canonical effect tokens, grain, and a tablet fallback", async () => {
  const [globals, noise] = await Promise.all([
    read("../src/app/globals.css"),
    read("../public/textures/noise.svg")
  ]);

  assert.match(globals, /blur\(var\(--glass-blur-md\)\) saturate\(var\(--glass-saturation\)\)/);
  assert.match(globals, /url\("\/textures\/noise\.svg"\)/);
  assert.match(globals, /opacity:\s*var\(--glass-noise-opacity\)/);
  assert.match(globals, /@media \(max-width:\s*1024px\)[\s\S]*backdrop-filter:\s*none/);
  assert.match(globals, /@media \(max-width:\s*1024px\)[\s\S]*-webkit-backdrop-filter:\s*none/);
  assert.match(noise, /feTurbulence/);
  assert.match(noise, /stitchTiles="stitch"/);
});
