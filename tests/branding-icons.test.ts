import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function pngSize(buffer: Buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("favicon and PWA raster icons use their declared square dimensions", async () => {
  const fixtures = [
    ["../public/icons/icon-192.png", 192],
    ["../public/icons/icon-512.png", 512],
    ["../public/icons/maskable-512.png", 512],
    ["../public/icons/apple-touch-icon.png", 180]
  ] as const;

  for (const [path, expectedSize] of fixtures) {
    const image = await readFile(new URL(path, import.meta.url));
    assert.deepEqual(pngSize(image), { width: expectedSize, height: expectedSize });
  }
});

test("static and dynamic favicons use the supplied geometric N mark without a wordmark", async () => {
  const publicIcon = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");
  const appIcon = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");
  const appearance = await readFile(new URL("../src/components/providers/appearance-provider.tsx", import.meta.url), "utf8");
  const markPath = "M112 104L326 282V148L392 198V414L178 236V370L112 320Z";

  assert.match(publicIcon, new RegExp(markPath));
  assert.match(appIcon, new RegExp(markPath));
  assert.match(appearance, new RegExp(markPath));
  assert.doesNotMatch(publicIcon, /<text|AI ROLEPLAY PLATFORM/i);
});
