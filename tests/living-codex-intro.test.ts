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
  assert.match(intro, /const INTRO_DURATION_MS = 2200/);
  assert.match(intro, /ssr: false/);
  assert.match(intro, /allowTablet: true/);
  assert.match(intro, /prefers-reduced-motion: reduce/);
  assert.match(intro, /data-living-codex-intro="true"/);
});

test("the launch scene opens a procedural book and pushes the camera through its interface", async () => {
  const scene = await read("../src/components/intro/living-codex-scene.tsx");

  assert.match(scene, /<Canvas/);
  assert.match(scene, /useFrame\(\(\{ clock, camera, size \}\)/);
  assert.match(scene, /leftCoverRef\.current\.rotation\.y/);
  assert.match(scene, /leftPagesRef\.current\.rotation\.y/);
  assert.match(scene, /rulesRef\.current\.scale\.x/);
  assert.match(scene, /const portraitFactor = clamp01/);
  assert.match(scene, /camera\.position\.z = THREE\.MathUtils\.lerp\(cameraStart, cameraEnd, passage\)/);
  assert.match(scene, /rulesRef\.current\.position\.z = 0\.054 \+ transform \* 0\.018/);
  assert.match(scene, /data-living-codex-canvas="true"/);
});

test("the launch gate includes a reduced-motion and WebGL fallback", async () => {
  const [intro, styles, capability] = await Promise.all([
    read("../src/components/intro/living-codex-intro.tsx"),
    read("../src/app/globals.css"),
    read("../src/lib/webgl-capability.ts")
  ]);

  assert.match(intro, /REDUCED_MOTION_DURATION_MS = 420/);
  assert.match(intro, /canRenderWebGL && !prefersReducedMotion/);
  assert.match(intro, /<LivingCodexStaticMark \/>/);
  assert.match(styles, /\.living-codex-static-book/);
  assert.match(capability, /options: \{ allowTablet\?: boolean \} = \{\}/);
  assert.match(capability, /isTabletWidth && !options\.allowTablet/);
});

test("the Expo shell loads the same root route so the shared intro runs in its WebView", async () => {
  const mobileApp = await read("../mobile/App.tsx");

  assert.match(mobileApp, /nythera-ai-character-platform\.vercel\.app/);
  assert.match(mobileApp, /source=\{\{ uri: SITE_URL \}\}/);
  assert.match(mobileApp, /startInLoadingState/);
});
