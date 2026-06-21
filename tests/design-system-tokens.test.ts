import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss, { type AtRule, type Rule } from "postcss";

const tokenFile = new URL("../src/styles/design-tokens.css", import.meta.url);
const contractSelectors = [":root", ":root, .dark", ".light"] as const;

function parseTokenContract(css: string) {
  const ast = postcss.parse(css);
  const baseLayers: AtRule[] = [];
  ast.walkAtRules("layer", (atRule) => {
    if (atRule.params.trim() === "base") baseLayers.push(atRule);
  });
  assert.equal(baseLayers.length, 1, "expected exactly one active @layer base");
  const layer = baseLayers[0];
  assert.equal(layer.parent?.type, "root", "@layer base must be top-level");

  ast.walkRules((rule) => {
    let parent = rule.parent;
    while (parent && parent !== layer) parent = parent.parent;
    assert.equal(parent, layer, `unexpected active style rule outside @layer base: ${rule.selector}`);
  });

  const rules = new Map<string, Map<string, string>>();
  for (const node of layer.nodes ?? []) {
    if (node.type === "comment") continue;
    assert.equal(node.type, "rule", `unexpected active ${node.type} inside @layer base`);
    const rule = node as Rule;
    const selector = rule.selector.trim();
    assert.ok(
      contractSelectors.includes(selector as (typeof contractSelectors)[number]),
      `unexpected selector in @layer base: ${selector}`
    );
    assert.ok(!rules.has(selector), `duplicate ${selector} block`);

    const declarations = new Map<string, string>();
    for (const child of rule.nodes ?? []) {
      if (child.type === "comment") continue;
      assert.equal(child.type, "decl", `unexpected active ${child.type} inside ${selector}`);
      assert.match(child.prop, /^--/, `non-token declaration in ${selector}: ${child.prop}`);
      const name = child.prop.slice(2);
      assert.ok(!declarations.has(name), `duplicate --${name} in ${selector}`);
      declarations.set(name, child.value.trim());
    }
    rules.set(selector, declarations);
  }

  assert.deepEqual([...rules.keys()], contractSelectors);
  return rules;
}

function assertToken(tokens: Map<string, string>, name: string, expected?: string) {
  assert.ok(tokens.has(name), `missing --${name}`);
  if (expected !== undefined) {
    assert.equal(tokens.get(name)!.replace(/\s+/g, " "), expected, `unexpected --${name}`);
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
  ] as [number, number, number];
}

function luminance(channels: [number, number, number]) {
  const linearChannels = linearSrgb(channels);
  linearChannels.forEach((channel, index) => {
    assert.ok(
      channel >= 0 && channel <= 1,
      `OKLCH ${channels.join(" ")} converts outside linear sRGB gamut at channel ${index}: ${channel}`
    );
  });
  const [red, green, blue] = linearChannels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: [number, number, number], second: [number, number, number]) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function resolveChannels(name: string, ...scopes: Map<string, string>[]) {
  const visited = new Set<string>();
  let currentName = name;

  while (true) {
    assert.ok(!visited.has(currentName), `circular token reference at --${currentName}`);
    visited.add(currentName);
    const value = scopes.find((scope) => scope.has(currentName))?.get(currentName);
    assert.ok(value, `missing --${currentName}`);
    const reference = value.match(/^var\(--([\w-]+)\)$/);
    if (!reference) return parseOklchChannels(value);
    currentName = reference[1];
  }
}

test("Aurora Ink tokens define the complete OKLCH design-system contract", async () => {
  const css = await readFile(tokenFile, "utf8");
  const rules = parseTokenContract(css);
  const root = rules.get(":root")!;
  const dark = rules.get(":root, .dark")!;
  const light = rules.get(".light")!;

  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i);

  const primitives = {
    "primitive-violet-500": "0.67 0.17 286",
    "primitive-violet-600": "0.59 0.19 286",
    "primitive-mint-400": "0.87 0.12 170",
    "primitive-mint-500": "0.78 0.13 170",
    "primitive-warning-500": "0.78 0.15 80",
    "primitive-danger-500": "0.65 0.2 25"
  };
  for (const [name, value] of Object.entries(primitives)) {
    assertToken(root, name, value);
    assert.ok(!dark.has(name) && !light.has(name), `--${name} must only be in standalone :root`);
  }

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
    "color-accent-primary": "var(--primitive-violet-500)",
    "color-accent-strong": "var(--primitive-violet-600)",
    "color-accent-secondary": "var(--primitive-mint-400)",
    "color-focus-ring": "var(--primitive-mint-400)",
    "color-warning": "var(--primitive-warning-500)",
    "color-danger": "var(--primitive-danger-500)"
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
    "color-accent-primary": "var(--primitive-violet-500)",
    "color-accent-strong": "var(--primitive-violet-600)",
    "color-accent-secondary": "var(--primitive-mint-400)",
    "color-focus-ring": "var(--primitive-violet-600)",
    "color-warning": "var(--primitive-warning-500)",
    "color-danger": "var(--primitive-danger-500)"
  };
  for (const [name, value] of Object.entries(darkSemantic)) assertToken(dark, name, value);
  for (const [name, value] of Object.entries(lightSemantic)) assertToken(light, name, value);
  for (const name of Object.keys(darkSemantic)) {
    assert.ok(!root.has(name), `semantic --${name} must be in theme blocks`);
  }

  const spacing = ["4px", "8px", "12px", "16px", "20px", "24px", "32px", "40px", "48px", "64px"];
  ["1", "2", "3", "4", "5", "6", "8", "10", "12", "16"].forEach((step, index) =>
    assertToken(root, `space-${step}`, spacing[index])
  );
  const radii = {
    "radius-compact": "6px",
    "radius-control": "12px",
    "radius-card": "20px",
    "radius-surface": "28px",
    "radius-panel": "36px",
    "radius-full": "9999px"
  };
  for (const [name, value] of Object.entries(radii)) assertToken(root, name, value);

  assertToken(root, "type-display", "clamp(2.5rem, 5vw, 4.5rem)");
  assertToken(root, "type-heading-1", "clamp(2rem, 3.5vw, 3.25rem)");
  assertToken(root, "type-heading-2", "clamp(1.5rem, 2.5vw, 2.25rem)");
  assertToken(root, "type-heading-3", "clamp(1.25rem, 1.5vw, 1.5rem)");
  assertToken(root, "type-body", "clamp(.9375rem, .9rem + .2vw, 1.0625rem)");

  for (const [name, value] of Object.entries({ subtle: "56%", standard: "72%", strong: "88%" })) {
    assertToken(root, `glass-surface-${name}`, value);
  }
  for (const [name, value] of Object.entries({ subtle: "40%", standard: "60%", strong: "80%" })) {
    assertToken(root, `glass-border-${name}`, value);
  }
  assertToken(root, "glass-blur-sm", "12px");
  assertToken(root, "glass-blur-md", "20px");
  assertToken(root, "glass-blur-lg", "28px");
  assertToken(root, "glass-saturation", "115%");
  assertToken(root, "glass-noise-opacity", "3.5%");
  assertToken(light, "glass-noise-opacity", "2.5%");
  assertToken(root, "focus-ring-opacity", "54%");

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
  for (const [name, value] of Object.entries(layout)) assertToken(root, name, value);

  assertToken(root, "gradient-aurora-primary", "linear-gradient(90deg, oklch(var(--color-accent-primary)), oklch(var(--color-accent-secondary)))");
  assertToken(root, "gradient-aurora-ambient", "radial-gradient(circle at 82% 0%, oklch(var(--color-accent-primary) / 0.18), transparent 40%), linear-gradient(145deg, oklch(var(--color-canvas)), oklch(var(--color-surface)) 68%, oklch(var(--color-canvas)))");

  const compatibilityAliases = {
    "bg-base": "oklch(var(--color-canvas))",
    "bg-surface": "oklch(var(--color-surface) / .72)",
    "bg-elevated": "oklch(var(--color-elevated) / .76)",
    "bg-input": "oklch(var(--color-surface) / .82)",
    "text-primary": "oklch(var(--color-text-primary))",
    "text-secondary": "oklch(var(--color-text-secondary))",
    "text-muted": "oklch(var(--color-text-muted))",
    "border-default": "oklch(var(--color-border-default) / 0.6)",
    "border-subtle": "oklch(var(--color-border-subtle) / 0.4)",
    "brand-primary": "oklch(var(--color-accent-primary))",
    "brand-primary-hover": "oklch(var(--color-accent-strong))",
    "brand-secondary": "oklch(var(--color-accent-secondary))",
    "brand-secondary-deep": "oklch(var(--primitive-violet-600))",
    "brand-glow": "oklch(var(--color-accent-primary) / .15)",
    "brand-glow-strong": "oklch(var(--color-accent-primary) / .28)",
    "accent-purple": "oklch(var(--color-accent-primary))",
    "accent-purple-hover": "oklch(var(--color-accent-strong))",
    "accent-purple-soft": "oklch(var(--color-accent-primary) / .16)",
    "accent-secondary": "oklch(var(--color-accent-secondary))",
    "accent-teal": "oklch(var(--primitive-mint-500))",
    "accent-rgb": "143 129 247",
    "bubble-user": "oklch(var(--color-accent-primary) / .24)",
    "bubble-char": "oklch(var(--color-surface) / .72)",
    "radius-sm": "var(--radius-compact)",
    "radius-md": "var(--radius-control)",
    "radius-lg": "var(--radius-card)",
    "radius-xl": "var(--radius-surface)",
    "radius-bubble": "var(--radius-card)",
    "radius-pill": "var(--radius-full)",
    radius: "var(--radius-card)",
    "text-display": "var(--type-display)",
    "text-title": "var(--type-heading-2)",
    "text-subtitle": "var(--type-body)",
    "text-body": "var(--type-body)",
    background: "var(--color-canvas)",
    foreground: "var(--color-text-primary)",
    card: "var(--color-surface)",
    "card-foreground": "var(--color-text-primary)",
    popover: "var(--color-elevated)",
    "popover-foreground": "var(--color-text-primary)",
    primary: "var(--color-accent-primary)",
    "primary-foreground": "var(--color-on-accent)",
    secondary: "var(--color-elevated)",
    "secondary-foreground": "var(--color-text-primary)",
    muted: "var(--color-surface)",
    "muted-foreground": "var(--color-text-secondary)",
    accent: "var(--color-accent-primary)",
    "accent-foreground": "var(--color-on-accent)",
    destructive: "var(--color-danger)",
    "destructive-foreground": "var(--color-on-danger)",
    border: "var(--color-border-default)",
    input: "var(--color-surface)",
    ring: "var(--color-focus-ring)"
  };
  for (const [name, value] of Object.entries(compatibilityAliases)) assertToken(root, name, value);
  assertToken(root, "color-on-accent", "0.115 0.027 276");
  assertToken(root, "color-on-danger", "0.115 0.027 276");

  const darkThemeAliases = {
    "elevation-raised": "0 14px 45px oklch(0 0 0 / .28)",
    "elevation-floating": "0 24px 80px oklch(0 0 0 / .38)",
    "elevation-glow": "0 0 42px oklch(var(--color-accent-primary) / .2)",
    "shadow-card": "var(--elevation-floating)",
    "shadow-soft": "var(--elevation-raised)",
    "shadow-glow": "var(--elevation-glow)",
    "shadow-glow-soft": "0 0 84px oklch(var(--color-accent-primary) / .11)",
    "glass-highlight": "inset 0 1px 0 oklch(var(--color-text-primary) / .08)",
    "app-body-gradient": "var(--gradient-aurora-ambient)",
    "app-shell-gradient": "var(--gradient-aurora-ambient)",
    "chat-overlay": "linear-gradient(180deg, oklch(var(--color-canvas) / .66), oklch(var(--color-canvas) / .9) 34%, oklch(var(--color-canvas)))"
  };
  const lightThemeAliases = {
    "elevation-raised": "0 12px 36px oklch(.35 .04 275 / .1)",
    "elevation-floating": "0 18px 60px oklch(.35 .04 275 / .12)",
    "elevation-glow": "0 0 34px oklch(var(--color-accent-primary) / .16)",
    "shadow-card": "var(--elevation-floating)",
    "shadow-soft": "var(--elevation-raised)",
    "shadow-glow": "var(--elevation-glow)",
    "shadow-glow-soft": "0 0 74px oklch(var(--color-accent-primary) / .1)",
    "glass-highlight": "inset 0 1px 0 oklch(var(--color-elevated) / .72)",
    "app-body-gradient": "var(--gradient-aurora-ambient)",
    "app-shell-gradient": "var(--gradient-aurora-ambient)",
    "chat-overlay": "linear-gradient(180deg, oklch(var(--color-canvas) / .7), oklch(var(--color-canvas) / .9) 34%, oklch(var(--color-canvas)))"
  };
  for (const [name, value] of Object.entries(darkThemeAliases)) assertToken(dark, name, value);
  for (const [name, value] of Object.entries(lightThemeAliases)) assertToken(light, name, value);
});

test("primary, secondary, and muted text maintain WCAG AA contrast on every theme surface", async () => {
  const css = await readFile(tokenFile, "utf8");
  const rules = parseTokenContract(css);

  for (const [theme, selector] of [["dark", ":root, .dark"], ["light", ".light"]] as const) {
    const tokens = rules.get(selector)!;
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

test("action foregrounds maintain WCAG AA contrast against accent and danger colors", async () => {
  const css = await readFile(tokenFile, "utf8");
  const rules = parseTokenContract(css);
  const root = rules.get(":root")!;

  for (const [theme, selector] of [["dark", ":root, .dark"], ["light", ".light"]] as const) {
    const themed = rules.get(selector)!;
    for (const foreground of ["primary-foreground", "accent-foreground"]) {
      const foregroundChannels = resolveChannels(foreground, themed, root);
      for (const background of ["color-accent-primary", "color-accent-secondary"]) {
        const ratio = contrast(foregroundChannels, resolveChannels(background, themed, root));
        assert.ok(
          ratio >= 4.5,
          `${theme} --${foreground} is ${ratio.toFixed(2)}:1 against --${background}; expected at least 4.5:1`
        );
      }
    }

    const dangerRatio = contrast(
      resolveChannels("destructive-foreground", themed, root),
      resolveChannels("color-danger", themed, root)
    );
    assert.ok(
      dangerRatio >= 4.5,
      `${theme} --destructive-foreground is ${dangerRatio.toFixed(2)}:1 against --color-danger; expected at least 4.5:1`
    );
  }
});

test("PostCSS contract parsing ignores comments and rejects active overrides", () => {
  const fixture = `
    /* @layer base { :root { --fixture: commented-rule; } } */
    @layer base {
      :root {
        /* --fixture: commented-declaration; */
        --fixture: active;
      }
      :root, .dark { --theme: dark; }
      .light { --theme: light; }
    }
  `;
  const parsed = parseTokenContract(fixture);
  assert.deepEqual([...parsed.get(":root")!.entries()], [["fixture", "active"]]);
  assert.throws(
    () => parseTokenContract(fixture.replace("--fixture: active;", "--fixture: active; --fixture: duplicate;")),
    /duplicate --fixture in :root/
  );
  assert.throws(
    () => parseTokenContract(`${fixture} .light { --theme: outer-override; }`),
    /unexpected active style rule outside @layer base/
  );
  assert.throws(
    () => parseTokenContract(`${fixture} @layer base {}`),
    /expected exactly one active @layer base/
  );
});

test("contrast conversion rejects out-of-gamut OKLCH instead of clamping", () => {
  assert.throws(() => luminance([0.7, 0.5, 30]), /outside linear sRGB gamut/);
});
