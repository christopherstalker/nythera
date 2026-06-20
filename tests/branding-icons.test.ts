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

test("install icons use cache-busting URLs and a fresh service-worker cache", async () => {
  const sources = await Promise.all(
    [
      "../src/app/manifest.ts",
      "../src/app/layout.tsx",
      "../src/app/(main)/download/page.tsx",
      "../src/components/pwa/mobile-install-prompt.tsx",
      "../public/offline.html"
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
  );
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const combined = sources.join("\n");

  assert.match(combined, /\/icons\/nythera-n-v2-192\.png/);
  assert.match(combined, /\/icons\/nythera-n-v2-512\.png/);
  assert.match(combined, /\/icons\/nythera-n-v2-apple-180\.png/);
  assert.doesNotMatch(combined, /\/icons\/(?:icon-192|icon-512|apple-touch-icon)\.png/);
  assert.match(serviceWorker, /nythera-v8/);
  assert.match(serviceWorker, /\/icons\/nythera-n-v2-maskable-512\.png/);

  const fixtures = [
    ["../public/icons/nythera-n-v2-192.png", 192],
    ["../public/icons/nythera-n-v2-512.png", 512],
    ["../public/icons/nythera-n-v2-maskable-512.png", 512],
    ["../public/icons/nythera-n-v2-apple-180.png", 180]
  ] as const;

  for (const [path, expectedSize] of fixtures) {
    const image = await readFile(new URL(path, import.meta.url));
    assert.deepEqual(pngSize(image), { width: expectedSize, height: expectedSize });
  }
});
