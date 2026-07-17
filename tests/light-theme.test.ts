import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Living Codex light theme uses archival paper and ink tokens", async () => {
  const [tokens, globals] = await Promise.all([
    read("../src/styles/design-tokens.css"),
    read("../src/app/globals.css")
  ]);

  const lightTheme = tokens.match(/\.light\s*\{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.ok(lightTheme, "missing light theme token block");
  assert.match(lightTheme, /--color-canvas:\s*0\.91 0\.018 78/);
  assert.match(lightTheme, /--codex-paper:\s*oklch\(0\.91 0\.018 78\)/);
  assert.match(lightTheme, /--codex-ivory:\s*oklch\(0\.22 0\.012 70\)/);
  assert.match(lightTheme, /--codex-rule:/);
  assert.doesNotMatch(lightTheme, /Phase 2 light mode is deferred/);
  assert.match(globals, /html\.light\s*\{\s*color-scheme:\s*light/);
  assert.match(globals, /html\.light \.living-codex-shell::after/);
  assert.match(globals, /html\.light \.nythera-cosmic-backdrop/);
  assert.match(globals, /html\.light \.nythera-cosmic-veil/);
});

test("appearance controls persist both light and dark themes", async () => {
  const [provider, settings, toggle, navRail] = await Promise.all([
    read("../src/components/providers/appearance-provider.tsx"),
    read("../src/components/settings/appearance-settings-client.tsx"),
    read("../src/components/layout/theme-toggle.tsx"),
    read("../src/components/nav/NavRail.tsx")
  ]);

  assert.match(provider, /theme\?: "dark" \| "light"/);
  assert.match(provider, /value === "dark" \|\| value === "light"/);
  assert.match(provider, /profile\?\.preferredTheme/);
  assert.match(provider, /localAppearance\.theme \|\|/);
  assert.match(settings, /\["dark", "light"\] as const/);
  assert.match(provider, /MutationObserver/);
  assert.match(provider, /saveStoredAppearance\(\{ theme: nextTheme \}\)/);
  assert.match(toggle, /activeTheme === "light" \? "dark" : "light"/);
  assert.match(navRail, /<ThemeToggle/);
  assert.match(navRail, /mobile-theme-toggle/);
  assert.doesNotMatch(settings, /setTheme\("dark"\)/);
});
