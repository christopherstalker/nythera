import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("motion exposes only the approved reusable presets", async () => {
  const motion = await import("../src/lib/motion").catch(() => null);

  assert.deepEqual(motion?.springSnappy, { type: "spring", stiffness: 420, damping: 32, mass: 0.75 });
  assert.deepEqual(motion?.springSoft, { type: "spring", stiffness: 220, damping: 28, mass: 0.9 });
  assert.deepEqual(motion?.easeStandard, { duration: 0.22, ease: [0.2, 0, 0, 1] });
  assert.deepEqual(Object.keys(motion ?? {}).sort(), ["easeStandard", "springSnappy", "springSoft"]);
});

test("the shared hook defaults to motion-safe rendering and CSS disables legacy loops", async () => {
  const [hook, globals] = await Promise.all([
    readFile(new URL("../src/hooks/use-prefers-reduced-motion.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(hook, /useReducedMotion/);
  assert.match(hook, /\?\? true/);
  assert.match(globals, /prefers-reduced-motion:\s*reduce/);
  assert.match(globals, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(globals, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(globals, /animation-iteration-count:\s*1\s*!important/);
  assert.match(globals, /scroll-behavior:\s*auto\s*!important/);
});
