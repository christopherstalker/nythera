import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Living Codex is a single permanent dark theme", async () => {
  const [tokens, globals, layout, sessionProvider, navRail, settings] = await Promise.all([
    read("../src/styles/design-tokens.css"),
    read("../src/app/globals.css"),
    read("../src/app/layout.tsx"),
    read("../src/components/providers/session-provider.tsx"),
    read("../src/components/nav/NavRail.tsx"),
    read("../src/app/(main)/settings/interface/page.tsx")
  ]);

  assert.doesNotMatch(tokens, /\.light\s*\{/);
  assert.doesNotMatch(globals, /html\.light/);
  assert.match(layout, /<html lang="en" className="dark"/);
  assert.doesNotMatch(layout, /prefers-color-scheme|#E5DCCB/);
  assert.doesNotMatch(sessionProvider, /ThemeProvider|next-themes|AppearanceProvider/);
  assert.doesNotMatch(navRail, /ThemeToggle|mobile-theme-toggle|Use light theme/);
  assert.doesNotMatch(settings, /Accent color|Choose accent color|\["dark", "light"\]/);
  assert.match(settings, /one permanent ink-dark theme and a fixed editorial palette/);

  await assert.rejects(() => access(new URL("../src/components/layout/theme-toggle.tsx", import.meta.url)));
  await assert.rejects(() => access(new URL("../src/components/providers/appearance-provider.tsx", import.meta.url)));
  await assert.rejects(() => access(new URL("../src/components/settings/appearance-settings-client.tsx", import.meta.url)));
});

test("profile APIs keep the app theme fixed while allowing a profile-only accent", async () => {
  const [profile, mobileProfile] = await Promise.all([
    read("../src/app/api/profile/route.ts"),
    read("../src/app/api/mobile/profile/route.ts")
  ]);

  assert.doesNotMatch([profile, mobileProfile].join("\n"), /preferredTheme/);
  assert.match(profile, /accentColor/);
  assert.doesNotMatch(mobileProfile, /accentColor/);
});

test("shared buttons use the fixed Living Codex action treatment", async () => {
  const button = await read("../src/components/ui/button.tsx");

  assert.match(button, /font-mono/);
  assert.match(button, /uppercase/);
  assert.match(button, /brand-secondary/);
  assert.match(button, /bg-transparent/);
  assert.doesNotMatch(button, /bg-primary text-primary-foreground/);
});
