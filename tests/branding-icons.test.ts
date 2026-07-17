import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function pngSize(buffer: Buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const iconFixtures = [
  ["../public/icons/nythera-codex-v1-192.png", 192],
  ["../public/icons/nythera-codex-v1-512.png", 512],
  ["../public/icons/nythera-codex-v1-maskable-512.png", 512],
  ["../public/icons/nythera-codex-v1-apple-180.png", 180],
  ["../public/icons/nythera-codex-v1-source.png", 1024],
  ["../src/app/icon.png", 512]
] as const;

test("Living Codex favicon and PWA raster icons use their declared dimensions", async () => {
  for (const [path, expectedSize] of iconFixtures) {
    const image = await readFile(new URL(path, import.meta.url));
    assert.deepEqual(pngSize(image), { width: expectedSize, height: expectedSize });
  }
});

test("brand paths have one TypeScript source of truth and no dynamic favicon override", async () => {
  const [brand, layout, manifest, rail, session] = await Promise.all([
    readFile(new URL("../src/lib/brand.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/nav/NavRail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/providers/session-provider.tsx", import.meta.url), "utf8")
  ]);

  for (const name of ["BRAND_ICON_SMALL", "BRAND_ICON_LARGE", "BRAND_ICON_MASKABLE", "BRAND_ICON_APPLE", "BRAND_OG_IMAGE", "BRAND_THEME_COLOR"]) {
    assert.match(brand, new RegExp(`export const ${name}`));
  }
  assert.match(layout, /BRAND_ICON_SMALL/);
  assert.match(manifest, /BRAND_ICON_MASKABLE/);
  assert.match(rail, /BRAND_ICON_SMALL/);
  assert.doesNotMatch([layout, manifest, rail, session].join("\n"), /updateDynamicFavicon|AppearanceProvider|\/icon\.svg/);
});

test("install icons use cache-busting Living Codex URLs and a fresh service-worker cache", async () => {
  const sources = await Promise.all([
    "../src/lib/brand.ts",
    "../src/app/manifest.ts",
    "../src/app/layout.tsx",
    "../src/app/(main)/download/page.tsx",
    "../src/components/pwa/mobile-install-prompt.tsx",
    "../public/offline.html",
    "../public/sw.js"
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const combined = sources.join("\n");

  assert.match(combined, /nythera-codex-v1-192\.png/);
  assert.match(combined, /nythera-codex-v1-512\.png/);
  assert.match(combined, /nythera-codex-v1-maskable-512\.png/);
  assert.match(combined, /nythera-codex-v1-apple-180\.png/);
  assert.match(combined, /nythera-codex-v1/);
  assert.doesNotMatch(combined, /velora-aurora|nythera-n-v2|icon-192|icon-512|apple-touch-icon|\/icon\.svg/);

  for (const oldPath of [
    "../src/app/icon.svg",
    "../public/og-image-v3.png",
    "../public/icons/velora-aurora-v4-192.png",
    "../public/icons/velora-aurora-v4-512.png",
    "../public/icons/velora-aurora-v4-maskable-512.png",
    "../public/icons/velora-aurora-v4-apple-180.png"
  ]) {
    await assert.rejects(() => readFile(new URL(oldPath, import.meta.url)));
  }
});

test("social previews use the new editorial N asset", async () => {
  const [layout, publicImage, appImage] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/icons/nythera-codex-v1-og.png", import.meta.url)),
    readFile(new URL("../src/app/opengraph-image.png", import.meta.url))
  ]);

  assert.match(layout, /BRAND_OG_IMAGE/);
  assert.deepEqual(pngSize(publicImage), { width: 1200, height: 630 });
  assert.deepEqual(pngSize(appImage), { width: 1200, height: 630 });
  assert.ok(publicImage.equals(appImage));
});
