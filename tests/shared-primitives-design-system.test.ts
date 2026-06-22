import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared primitives consume semantic content, outline, surface, and radius tokens", async () => {
  const sources = await Promise.all(
    ["button.tsx", "input.tsx", "textarea.tsx", "badge.tsx", "page.tsx"].map((file) =>
      readFile(new URL(`../src/components/ui/${file}`, import.meta.url), "utf8")
    )
  );
  const combined = sources.join("\n");

  assert.match(combined, /text-content-primary/);
  assert.match(combined, /text-content-secondary/);
  assert.match(combined, /border-outline/);
  assert.match(combined, /rounded-control/);
  assert.match(combined, /disabled:text-content-disabled/);
  assert.doesNotMatch(combined, /rounded-\[var\(--radius-(?:md|lg|xl)\)\]/);
  assert.doesNotMatch(combined, /text-\[var\(--text-(?:primary|secondary|muted)\)\]/);
});

test("shared controls preserve Phase 0 interaction behavior and touch targets", async () => {
  const source = await readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /from "motion\/react"|motion\./);
  assert.match(source, /active:scale-95/);
  assert.doesNotMatch(source, /sm:\s*"h-9/);
  assert.match(source, /sm:\s*"h-11/);
});

test("shared focus and input surfaces compose canonical effect tokens", async () => {
  const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(globals, /oklch\(var\(--ring\) \/ var\(--focus-ring-opacity\)\)/);
  assert.match(globals, /oklch\(var\(--color-surface\) \/ var\(--glass-surface-strong\)\)/);
  assert.match(globals, /blur\(var\(--glass-blur-md\)\)/);
});
