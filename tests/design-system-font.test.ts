import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Space Grotesk is local, variable, licensed, and wired through next/font/local", async () => {
  const [layout, font, license] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/assets/fonts/SpaceGrotesk-Variable.woff2", import.meta.url)),
    readFile(new URL("../src/assets/fonts/OFL.txt", import.meta.url), "utf8")
  ]);

  assert.equal(font.toString("ascii", 0, 4), "wOF2");
  assert.match(license, /SIL OPEN FONT LICENSE/i);
  assert.match(layout, /localFont/);
  assert.match(layout, /SpaceGrotesk-Variable\.woff2/);
  assert.match(layout, /weight:\s*"300 700"/);
  assert.match(layout, /--font-space-grotesk/);
  assert.doesNotMatch(layout, /next\/font\/google|\bInter\(/);
});

test("browser chrome uses the single Living Codex dark canvas", async () => {
  const [layout, brand] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/brand.ts", import.meta.url), "utf8")
  ]);

  assert.match(layout, /BRAND_THEME_COLOR/);
  assert.match(brand, /#080907/);
  assert.doesNotMatch([layout, brand].join("\n"), /#E5DCCB|prefers-color-scheme/);
});
