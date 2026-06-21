import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tokenFile = new URL("../src/styles/design-tokens.css", import.meta.url);

function declarationsFor(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing exact ${selector} block`);

  return new Map(
    [...match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
      declaration[1],
      declaration[2].trim()
    ])
  );
}

function assertToken(tokens: Map<string, string>, name: string, expected?: string) {
  assert.ok(tokens.has(name), `missing --${name}`);
  if (expected !== undefined) {
    assert.equal(tokens.get(name), expected, `unexpected --${name}`);
  }
}

function parseOklchChannels(value: string) {
  const channels = value.match(/^(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)$/);
  assert.ok(channels, `expected OKLCH channels, received ${value}`);
  return channels.slice(1).map(Number) as [number, number, number];
}

function linearSrgb([lightness, chroma, hue]: [number, number, number]) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map((channel) => Math.min(1, Math.max(0, channel))) as [number, number, number];
}

function luminance(channels: [number, number, number]) {
  const [red, green, blue] = linearSrgb(channels);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: [number, number, number], second: [number, number, number]) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

test("Aurora Ink tokens define the complete OKLCH design-system contract", async () => {
  const css = await readFile(tokenFile, "utf8");
  const dark = declarationsFor(css, ":root, .dark");
  const light = declarationsFor(css, ".light");

  assert.match(css, /@layer\s+base\s*\{/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i);

  const primitives = {
    "color-violet-500": "0.67 0.17 286",
    "color-violet-600": "0.59 0.19 286",
    "color-mint-400": "0.87 0.12 170",
    "color-mint-500": "0.78 0.13 170",
    "color-warning-500": "0.78 0.15 80",
    "color-danger-500": "0.65 0.2 25"
  };
  for (const [name, value] of Object.entries(primitives)) assertToken(dark, name, value);

  const darkSemantic = {
    "color-canvas": "0.115 0.027 276",
    "color-surface": "0.165 0.035 276",
    "color-elevated": "0.215 0.042 276",
    "color-text-primary": "0.96 0.012 270",
    "color-text-secondary": "0.78 0.035 270",
    "color-text-muted": "0.64 0.035 270",
    "color-text-disabled": "0.49 0.026 270",
    "color-border-subtle": "0.35 0.04 276",
    "color-border-default": "0.45 0.04 276",
    "color-border-strong": "0.6 0.04 276",
    "color-border-disabled": "0.28 0.025 276",
    "color-accent-primary": "var(--color-violet-500)",
    "color-accent-strong": "var(--color-violet-600)",
    "color-accent-secondary": "var(--color-mint-400)",
    "color-focus-ring": "var(--color-mint-400)",
    "color-warning": "var(--color-warning-500)",
    "color-danger": "var(--color-danger-500)"
  };
  const lightSemantic = {
    "color-canvas": "0.965 0.012 270",
    "color-surface": "0.988 0.004 270",
    "color-elevated": "0.999 0 0",
    "color-text-primary": "0.22 0.04 275",
    "color-text-secondary": "0.42 0.045 275",
    "color-text-muted": "0.48 0.04 275",
    "color-text-disabled": "0.65 0.025 275",
    "color-border-subtle": "0.82 0.03 275",
    "color-border-default": "0.72 0.035 275",
    "color-border-strong": "0.55 0.04 275",
    "color-border-disabled": "0.88 0.015 275",
    "color-accent-primary": "var(--color-violet-500)",
    "color-accent-strong": "var(--color-violet-600)",
    "color-accent-secondary": "var(--color-mint-400)",
    "color-focus-ring": "var(--color-violet-600)",
    "color-warning": "var(--color-warning-500)",
    "color-danger": "var(--color-danger-500)"
  };
  for (const [name, value] of Object.entries(darkSemantic)) assertToken(dark, name, value);
  for (const [name, value] of Object.entries(lightSemantic)) assertToken(light, name, value);

  const spacing = ["4px", "8px", "12px", "16px", "20px", "24px", "32px", "40px", "48px", "64px"];
  ["1", "2", "3", "4", "5", "6", "8", "10", "12", "16"].forEach((step, index) =>
    assertToken(dark, `space-${step}`, spacing[index])
  );
  const radii = {
    "radius-compact": "6px",
    "radius-control": "12px",
    "radius-card": "20px",
    "radius-surface": "28px",
    "radius-panel": "36px",
    "radius-full": "9999px"
  };
  for (const [name, value] of Object.entries(radii)) assertToken(dark, name, value);

  assertToken(dark, "type-display", "clamp(2.5rem, 5vw, 4.5rem)");
  assertToken(dark, "type-heading-1", "clamp(2rem, 3.5vw, 3.25rem)");
  assertToken(dark, "type-heading-2", "clamp(1.5rem, 2.5vw, 2.25rem)");
  assertToken(dark, "type-heading-3", "clamp(1.25rem, 1.5vw, 1.5rem)");
  assertToken(dark, "type-body", "clamp(.9375rem, .9rem + .2vw, 1.0625rem)");

  for (const [name, value] of Object.entries({ subtle: "56%", standard: "72%", strong: "88%" })) {
    assertToken(dark, `glass-surface-${name}`, value);
  }
  for (const [name, value] of Object.entries({ subtle: "40%", standard: "60%", strong: "80%" })) {
    assertToken(dark, `glass-border-${name}`, value);
  }
  assertToken(dark, "glass-blur-sm", "12px");
  assertToken(dark, "glass-blur-md", "20px");
  assertToken(dark, "glass-blur-lg", "28px");
  assertToken(dark, "glass-saturation", "115%");
  assertToken(dark, "glass-noise-opacity", "3.5%");
  assertToken(light, "glass-noise-opacity", "2.5%");
  assertToken(dark, "focus-ring-opacity", "54%");

  const layout = {
    "page-padding-x": "clamp(1rem, 2.8vw, 2.5rem)",
    "page-padding-y": "clamp(1rem, 2vw, 2rem)",
    "page-max-width": "72rem",
    "content-max-width": "57.5rem",
    "chat-max-width": "min(920px, calc(100vw - 2rem))",
    "card-min-width": "clamp(9.75rem, 42vw, 12.5rem)",
    "card-height": "clamp(16.5rem, 38vw, 18.75rem)",
    "grid-gap": "clamp(0.75rem, 1.8vw, 1.25rem)",
    "bottom-nav-offset": "calc(5.75rem + env(safe-area-inset-bottom))",
    "touch-target": "44px",
    "sidebar-width": "260px",
    "sidebar-collapsed": "64px"
  };
  for (const [name, value] of Object.entries(layout)) assertToken(dark, name, value);

  for (const gradient of ["gradient-aurora-primary", "gradient-aurora-ambient"]) {
    assertToken(dark, gradient);
    assert.match(dark.get(gradient)!, /oklch\(var\(--/);
  }
  for (const elevation of ["elevation-raised", "elevation-floating", "elevation-glow"]) {
    assertToken(dark, elevation);
    assert.match(dark.get(elevation)!, /oklch\(/);
    assertToken(light, elevation);
    assert.match(light.get(elevation)!, /oklch\(/);
  }

  const compatibilityAliases = [
    "bg-base", "bg-surface", "bg-elevated", "bg-input",
    "text-primary", "text-secondary", "text-muted",
    "border-default", "border-subtle",
    "brand-primary", "brand-primary-hover", "brand-secondary", "brand-secondary-deep",
    "accent-purple", "accent-purple-hover", "accent-purple-soft", "accent-secondary", "accent-teal", "accent-rgb",
    "bubble-user", "bubble-char",
    "radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-bubble", "radius-pill", "radius",
    "text-display", "text-title", "text-subtitle", "text-body",
    "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
    "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
    "accent", "accent-foreground", "destructive", "destructive-foreground", "border", "input", "ring",
    "shadow-card", "shadow-soft", "shadow-glow", "shadow-glow-soft", "glass-highlight",
    "app-body-gradient", "app-shell-gradient", "chat-overlay"
  ];
  for (const alias of compatibilityAliases) assertToken(dark, alias);
  for (const alias of [
    "shadow-card", "shadow-soft", "shadow-glow", "shadow-glow-soft", "glass-highlight",
    "app-body-gradient", "app-shell-gradient", "chat-overlay"
  ]) assertToken(light, alias);
});

test("primary, secondary, and muted text maintain WCAG AA contrast on every theme surface", async () => {
  const css = await readFile(tokenFile, "utf8");

  for (const [theme, selector] of [["dark", ":root, .dark"], ["light", ".light"]] as const) {
    const tokens = declarationsFor(css, selector);
    for (const textToken of ["color-text-primary", "color-text-secondary", "color-text-muted"]) {
      const textChannels = parseOklchChannels(tokens.get(textToken)!);
      for (const surfaceToken of ["color-canvas", "color-surface", "color-elevated"]) {
        const surfaceChannels = parseOklchChannels(tokens.get(surfaceToken)!);
        const ratio = contrast(textChannels, surfaceChannels);
        assert.ok(
          ratio >= 4.5,
          `${theme} --${textToken} is ${ratio.toFixed(2)}:1 against --${surfaceToken}; expected at least 4.5:1`
        );
      }
    }
  }
});
