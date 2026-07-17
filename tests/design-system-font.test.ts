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

test("browser chrome uses the Living Codex canvas colors", async () => {
  const [layout, appearance] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/providers/appearance-provider.tsx", import.meta.url), "utf8")
  ]);

  for (const color of ["#03040F", "#E5DCCB"]) {
    assert.match(layout, new RegExp(color));
    assert.match(appearance, new RegExp(color));
  }
});
