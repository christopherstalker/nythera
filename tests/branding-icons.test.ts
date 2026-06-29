import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function pngSize(buffer: Buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("favicon and PWA raster icons use their declared square dimensions", async () => {
  const fixtures = [
    ["../public/icons/velora-aurora-v4-192.png", 192],
    ["../public/icons/velora-aurora-v4-512.png", 512],
    ["../public/icons/velora-aurora-v4-maskable-512.png", 512],
    ["../public/icons/velora-aurora-v4-apple-180.png", 180]
  ] as const;

  for (const [path, expectedSize] of fixtures) {
    const image = await readFile(new URL(path, import.meta.url));
    assert.deepEqual(pngSize(image), { width: expectedSize, height: expectedSize });
  }
});

test("static and dynamic favicons use the supplied geometric N mark without a wordmark", async () => {
  const appIcon = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");
  const appearance = await readFile(new URL("../src/components/providers/appearance-provider.tsx", import.meta.url), "utf8");
  const markPath = "M112 104L326 282V148L392 198V414L178 236V370L112 320Z";

  assert.match(appIcon, new RegExp(markPath));
  assert.match(appearance, new RegExp(markPath));
  assert.match(appIcon, /#8F81F7/);
  assert.match(appIcon, /#6EE7D8/);
  assert.match(appearance, /BRAND_LOGO_PRIMARY = "#8F81F7"/);
  assert.match(appearance, /BRAND_LOGO_SECONDARY = "#6EE7D8"/);
  assert.doesNotMatch(appIcon, /<text|AI ROLEPLAY PLATFORM/i);
  assert.doesNotMatch([appIcon, appearance].join("\n"), /#FF5A0A|#FF7A18|#FFB52E|#FFB347/i);
  await assert.rejects(() => readFile(new URL("../public/icon.svg", import.meta.url)));
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

  assert.match(combined, /\/icons\/velora-aurora-v4-192\.png/);
  assert.match(combined, /\/icons\/velora-aurora-v4-512\.png/);
  assert.match(combined, /\/icons\/velora-aurora-v4-apple-180\.png/);
  assert.doesNotMatch(combined, /\/icons\/(?:icon-192|icon-512|apple-touch-icon|nythera-n-v2-[^"')]+|velora-aurora-v3-[^"')]+)\.png/);
  assert.match(serviceWorker, /velora-brand-v10/);
  assert.match(serviceWorker, /\/icons\/velora-aurora-v4-maskable-512\.png/);
  assert.doesNotMatch(serviceWorker, /nythera-v9|nythera-n-v2|icon-192|icon-512|apple-touch-icon|velora-aurora-v3/);

  const fixtures = [
    ["../public/icons/velora-aurora-v4-192.png", 192],
    ["../public/icons/velora-aurora-v4-512.png", 512],
    ["../public/icons/velora-aurora-v4-maskable-512.png", 512],
    ["../public/icons/velora-aurora-v4-apple-180.png", 180]
  ] as const;

  for (const [path, expectedSize] of fixtures) {
    const image = await readFile(new URL(path, import.meta.url));
    assert.deepEqual(pngSize(image), { width: expectedSize, height: expectedSize });
  }

  for (const oldPath of [
    "../public/icons/icon-192.png",
    "../public/icons/icon-512.png",
    "../public/icons/maskable-512.png",
    "../public/icons/apple-touch-icon.png",
    "../public/icons/nythera-n-v2-192.png",
    "../public/icons/nythera-n-v2-512.png",
    "../public/icons/nythera-n-v2-maskable-512.png",
    "../public/icons/nythera-n-v2-apple-180.png",
    "../public/icons/velora-aurora-v3-192.png",
    "../public/icons/velora-aurora-v3-512.png",
    "../public/icons/velora-aurora-v3-maskable-512.png",
    "../public/icons/velora-aurora-v3-apple-180.png"
  ]) {
    await assert.rejects(() => readFile(new URL(oldPath, import.meta.url)));
  }
});

test("social previews use the aurora N landscape image and a versioned public URL", async () => {
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

  assert.match(layout, /\/og-image-v3\.png/);
  assert.doesNotMatch(layout, /["']\/og-image(?:-v2)?\.png["']/);

  const publicImage = await readFile(new URL("../public/og-image-v3.png", import.meta.url));
  const appImage = await readFile(new URL("../src/app/opengraph-image.png", import.meta.url));

  assert.deepEqual(pngSize(publicImage), { width: 1200, height: 630 });
  assert.deepEqual(pngSize(appImage), { width: 1200, height: 630 });
  assert.ok(publicImage.equals(appImage));
  await assert.rejects(() => readFile(new URL("../public/og-image.png", import.meta.url)));
  await assert.rejects(() => readFile(new URL("../public/og-image-v2.png", import.meta.url)));
});
