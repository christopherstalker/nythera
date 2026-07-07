import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("cosmic backdrop gates the WebGL starfield behind a dynamic import", async () => {
  const backdrop = await read("../src/components/ambient/cosmic-backdrop.tsx");

  assert.ok(backdrop.includes("dynamic("));
  assert.ok(backdrop.includes("@/components/ambient/space-background-webgl"));
  assert.ok(backdrop.includes("ssr: false"));
  assert.ok(backdrop.includes("loading: () => null"));
  assert.ok(backdrop.includes("checkWebGLSupportAndCapability"));
  assert.ok(backdrop.includes("webglSupported === false || webglSupported === null"));
  assert.ok(backdrop.includes("<SpaceBackground />"));
  assert.doesNotMatch(backdrop, /@react-three\/fiber|@react-three\/drei|from "three"/);
  assert.doesNotMatch(backdrop, /AuroraWebglBackground/);
});

test("capability check keeps reduced motion, tablet, and weak GPU devices on fallback", async () => {
  const capability = await read("../src/lib/webgl-capability.ts");

  assert.ok(capability.includes('typeof window === "undefined"'));
  assert.ok(capability.includes("prefers-reduced-motion: reduce"));
  assert.ok(capability.includes("window.innerWidth >= 768 && window.innerWidth <= 1024"));
  assert.ok(capability.includes('getContext("webgl2")'));
  assert.ok(capability.includes('getContext("webgl")'));
  assert.ok(capability.includes("WEBGL_debug_renderer_info"));
  assert.ok(capability.includes("UNMASKED_RENDERER_WEBGL"));
  assert.ok(capability.includes("swiftshader|llvmpipe|software"));
  assert.ok(capability.includes("WEBGL_lose_context"));
});

test("canvas fallback is motion-safe and never creates a WebGL context", async () => {
  const fallback = await read("../src/components/ambient/space-background.tsx");

  assert.ok(fallback.includes('data-nythera-space-fallback="true"'));
  assert.ok(fallback.includes('data-nythera-space-canvas="true"'));
  assert.ok(fallback.includes('getContext("2d"'));
  assert.ok(fallback.includes("prefers-reduced-motion: reduce"));
  assert.ok(fallback.includes("Math.min(window.devicePixelRatio || 1, 2)"));
  assert.ok(fallback.includes("window.innerWidth <= 1024"));
  assert.doesNotMatch(fallback, /getContext\("webgl|@react-three|from "three"/);
});

test("webgl starfield stays cheap and isolated from the main bundle", async () => {
  const webgl = await read("../src/components/ambient/space-background-webgl.tsx");
  const packageJson = await read("../package.json");

  assert.ok(webgl.includes('from "@react-three/fiber"'));
  assert.ok(webgl.includes('from "@react-three/drei"'));
  assert.ok(webgl.includes('from "three"'));
  assert.ok(webgl.includes("<Stars"));
  assert.ok(webgl.includes("count={2200}"));
  assert.ok(webgl.includes("mouse.current.x * 0.15"));
  assert.ok(webgl.includes("-mouse.current.y * 0.1"));
  assert.ok(webgl.includes("scrollY.current * 0.0003"));
  assert.ok(webgl.includes('powerPreference: "low-power"'));
  assert.ok(webgl.includes("dpr={[1, 2]}"));
  assert.doesNotMatch(webgl, /postprocessing|Bloom|EffectComposer/);
  assert.ok(packageJson.includes('"@react-three/fiber"'));
  assert.ok(packageJson.includes('"@react-three/drei"'));
  assert.ok(packageJson.includes('"three"'));
});
