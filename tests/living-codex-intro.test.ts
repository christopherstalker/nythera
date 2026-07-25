import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("the Living Codex launch gate is mounted once above the application shell", async () => {
  const [layout, intro] = await Promise.all([
    read("../src/app/layout.tsx"),
    read("../src/components/intro/living-codex-intro.tsx")
  ]);

  assert.match(
    layout,
    /<LivingCodexIntro\s*\/>\s*<OrientationLock\s*\/>\s*<AppShell>/
  );
  assert.match(intro, /const INTRO_DURATION_MS = 2400/);
  assert.match(intro, /ssr: false/);
  assert.match(intro, /allowTablet: true/);
  assert.match(intro, /prefers-reduced-motion: reduce/);
  assert.match(intro, /renderMode === "webgl" && sceneReady/);
  assert.match(intro, /started && "is-started"/);
  assert.match(intro, /<LivingCodexScene onReady=\{\(\) => setSceneReady\(true\)\} \/>/);
  assert.match(intro, /data-living-codex-intro="true"/);
});

test("the launch scene summons a procedural book, turns its pages, and dives through a portal", async () => {
  const scene = await read("../src/components/intro/living-codex-scene.tsx");

  assert.match(scene, /<Canvas/);
  assert.match(scene, /useFrame\(\(\{ clock, camera, size \}\)/);
  assert.match(scene, /leftCoverRef\.current\.rotation\.y/);
  assert.match(scene, /const PAGE_COUNT = 8/);
  assert.match(scene, /pageRefs\.current\.forEach/);
  assert.match(scene, /page\.rotation\.y = THREE\.MathUtils\.lerp/);
  assert.match(scene, /<RitualHalo haloRef=\{haloRef\} glyphRef=\{glyphRef\} \/>/);
  assert.match(scene, /<InterfaceFragments fragmentsRef=\{fragmentsRef\} \/>/);
  assert.match(scene, /<CodexPortal portalRef=\{portalRef\} coreRef=\{portalCoreRef\} \/>/);
  assert.match(scene, /const portraitFactor = clamp01/);
  assert.match(scene, /perspectiveCamera\.position\.z = THREE\.MathUtils\.lerp\(cameraStart, 1\.2, dive\)/);
  assert.match(scene, /perspectiveCamera\.fov = THREE\.MathUtils\.lerp\(39, 54, dive\)/);
  assert.match(scene, /onCreated=\{onReady\}/);
  assert.match(scene, /data-living-codex-canvas="true"/);
});

test("the launch gate includes a reduced-motion and WebGL fallback", async () => {
  const [intro, styles, capability] = await Promise.all([
    read("../src/components/intro/living-codex-intro.tsx"),
    read("../src/app/globals.css"),
    read("../src/lib/webgl-capability.ts")
  ]);

  assert.match(intro, /REDUCED_MOTION_DURATION_MS = 420/);
  assert.match(intro, /canRenderWebGL && !prefersReducedMotion \? "webgl" : "fallback"/);
  assert.match(intro, /<LivingCodexStaticMark \/>/);
  assert.match(styles, /\.living-codex-static-book/);
  assert.match(styles, /\.living-codex-static-ring/);
  assert.match(styles, /\.living-codex-static-fragments/);
  assert.match(styles, /\.living-codex-intro\.is-leaving::after/);
  assert.match(capability, /options: \{ allowTablet\?: boolean \} = \{\}/);
  assert.match(capability, /isTabletWidth && !options\.allowTablet/);
});

test("the Expo shell loads the same root route so the shared intro runs in its WebView", async () => {
  const mobileApp = await read("../mobile/App.tsx");

  assert.match(mobileApp, /nythera-ai-character-platform\.vercel\.app/);
  assert.match(mobileApp, /source=\{\{ uri: SITE_URL \}\}/);
  assert.match(mobileApp, /startInLoadingState/);
});
