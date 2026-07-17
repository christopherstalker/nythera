import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import postcss, { type AcceptedPlugin, type AnyNode, type AtRule, type Rule } from "postcss";
import tailwindcss from "tailwindcss";
import tailwindConfig from "../tailwind.config";

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
    let parent: AnyNode | undefined = rule.parent;
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
    "primitive-violet-500": "0.74 0.13 250",
    "primitive-violet-600": "0.68 0.14 250",
    "primitive-mint-400": "0.82 0.12 170",
    "primitive-mint-500": "0.76 0.13 170",
    "primitive-warning-500": "0.78 0.15 80",
    "primitive-danger-500": "0.65 0.2 25"
  };
  for (const [name, value] of Object.entries(primitives)) {
    assertToken(root, name, value);
    assert.ok(!dark.has(name) && !light.has(name), `--${name} must only be in standalone :root`);
  }

  const darkSemantic = {
    "color-canvas": "0.08 0 0",
    "color-surface": "0.16 0 0",
    "color-elevated": "0.22 0 0",
    "color-overlay": "oklch(var(--color-elevated) / .72)",
    "color-text-primary": "0.98 0 0",
    "color-text-secondary": "0.86 0 0",
    "color-text-muted": "0.74 0 0",
    "color-text-disabled": "0.55 0 0",
    "color-border-subtle": "0.36 0 0",
    "color-border-default": "0.48 0 0",
    "color-border-strong": "0.72 0 0",
    "color-border-disabled": "0.28 0 0",
    "color-accent-primary": "var(--primitive-violet-500)",
    "color-accent-strong": "var(--primitive-violet-600)",
    "color-accent-secondary": "var(--primitive-mint-400)",
    "color-focus-ring": "var(--primitive-mint-400)",
    "color-warning": "var(--primitive-warning-500)",
    "color-danger": "var(--primitive-danger-500)"
  };
  const lightSemantic = {
    "color-canvas": "0.91 0.018 78",
    "color-surface": "0.945 0.014 78",
    "color-elevated": "0.965 0.011 78",
    "color-overlay": "oklch(var(--color-elevated) / .86)",
    "color-text-primary": "0.22 0.012 70",
    "color-text-secondary": "0.38 0.015 70",
    "color-text-muted": "0.49 0.014 70",
    "color-text-disabled": "0.64 0.012 75",
    "color-border-subtle": "0.73 0.018 72",
    "color-border-default": "0.61 0.02 70",
    "color-border-strong": "0.39 0.018 70",
    "color-border-disabled": "0.78 0.015 75",
    "color-accent-primary": "0.6 0.12 292",
    "color-accent-strong": "0.5 0.13 292",
    "color-accent-secondary": "0.58 0.09 174",
    "color-focus-ring": "0.46 0.09 174",
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
    "radius-compact": "4px",
    "radius-control": "12px",
    "radius-card": "20px",
    "radius-surface": "28px",
    "radius-panel": "36px",
    "radius-full": "9999px"
  };
  for (const [name, value] of Object.entries(radii)) assertToken(root, name, value);

  assertToken(root, "type-display", "clamp(2.5rem, 5vw, 4rem)");
  assertToken(root, "type-heading-1", "clamp(1.75rem, 3vw, 2.5rem)");
  assertToken(root, "type-heading-2", "clamp(1.25rem, 2vw, 1.75rem)");
  assertToken(root, "type-heading-3", "clamp(1rem, 1.5vw, 1.25rem)");
  assertToken(root, "type-body", "1rem");

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
    "page-max-width": "74rem",
    "content-max-width": "45rem",
    "chat-max-width": "min(720px, calc(100vw - 2rem))",
    "card-min-width": "clamp(9.75rem, 42vw, 12.5rem)",
    "card-height": "clamp(16.5rem, 38vw, 18.75rem)",
    "grid-gap": "clamp(0.75rem, 1.8vw, 1.25rem)",
    "bottom-nav-offset": "calc(92px + env(safe-area-inset-bottom))",
    "touch-target": "44px",
    "sidebar-width": "220px",
    "sidebar-collapsed": "64px",
    "nav-rail-collapsed": "64px",
    "nav-rail-expanded": "220px",
    "top-bar-height": "80px",
    "side-panel-width": "280px"
  };
  for (const [name, value] of Object.entries(layout)) assertToken(root, name, value);

  assertToken(
    root,
    "gradient-aurora-primary",
    "linear-gradient(120deg, oklch(var(--color-accent-primary)) 0%, oklch(var(--color-accent-secondary)) 100%)"
  );
  assertToken(
    root,
    "gradient-aurora-ambient",
    "radial-gradient(ellipse 80% 55% at 20% 78%, oklch(var(--color-accent-primary) / .38) 0%, transparent 58%), radial-gradient(ellipse 70% 45% at 78% 22%, oklch(var(--color-accent-secondary) / .28) 0%, transparent 62%)"
  );

  const compatibilityAliases = {
    "bg-base": "oklch(var(--color-canvas))",
    "bg-surface": "oklch(var(--color-surface))",
    "bg-elevated": "oklch(var(--color-elevated))",
    "bg-input": "oklch(var(--color-surface))",
    "text-primary": "oklch(var(--color-text-primary))",
    "text-secondary": "oklch(var(--color-text-secondary))",
    "text-muted": "oklch(var(--color-text-muted))",
    "border-default": "oklch(var(--color-border-default) / 0.6)",
    "border-subtle": "oklch(var(--color-border-subtle) / 0.4)",
    "brand-primary": "oklch(var(--color-accent-primary))",
    "brand-primary-hover": "oklch(var(--color-accent-strong))",
    "brand-secondary": "oklch(var(--color-accent-secondary))",
    "brand-secondary-deep": "oklch(var(--primitive-violet-600))",
    "border-strong": "oklch(var(--color-border-strong))",
    "brand-glow": "transparent",
    "brand-glow-strong": "transparent",
    "accent-purple": "oklch(var(--color-accent-primary))",
    "accent-purple-hover": "oklch(var(--color-accent-strong))",
    "accent-purple-soft": "oklch(var(--color-accent-primary) / .28)",
    "accent-secondary": "oklch(var(--color-accent-secondary))",
    "accent-teal": "oklch(var(--primitive-mint-500))",
    "accent-rgb": "143 129 247",
    "bubble-user": "oklch(var(--color-accent-primary))",
    "bubble-char": "oklch(var(--color-surface))",
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
  assertToken(root, "color-on-accent", "0.08 0 0");
  assertToken(root, "color-on-danger", "0.08 0 0");

  const darkThemeAliases = {
    "elevation-raised": "0 16px 42px oklch(0 0 0 / .26)",
    "elevation-floating": "0 24px 72px oklch(0 0 0 / .34)",
    "elevation-glow": "0 0 0 1px oklch(var(--color-focus-ring) / .46), 0 0 42px oklch(var(--color-accent-primary) / .24)",
    "shadow-card": "var(--elevation-floating)",
    "shadow-elevated": "var(--elevation-floating)",
    "shadow-soft": "var(--elevation-raised)",
    "shadow-glow": "var(--elevation-glow)",
    "shadow-glow-soft": "0 0 32px oklch(var(--color-accent-primary) / .18)",
    "glass-highlight": "inset 0 1px 0 oklch(1 0 0 / .08)",
    "app-body-gradient": "var(--gradient-aurora-ambient), var(--bg-base)",
    "app-shell-gradient": "linear-gradient(180deg, oklch(var(--color-canvas)) 0%, oklch(var(--color-canvas) / .96) 100%)",
    "chat-overlay": "oklch(var(--color-canvas) / .9)"
  };
  const lightThemeAliases = {
    "elevation-raised": "0 16px 42px oklch(0.24 0.012 70 / .11)",
    "elevation-floating": "0 24px 72px oklch(0.24 0.012 70 / .16)",
    "elevation-glow": "0 0 0 1px oklch(var(--color-focus-ring) / .34), 0 0 38px oklch(var(--color-accent-primary) / .12)",
    "shadow-card": "var(--elevation-floating)",
    "shadow-elevated": "var(--elevation-floating)",
    "shadow-soft": "var(--elevation-raised)",
    "shadow-glow": "var(--elevation-glow)",
    "shadow-glow-soft": "0 0 32px oklch(var(--color-accent-primary) / .11)",
    "glass-highlight": "inset 0 1px 0 oklch(1 0 0 / .5)",
    "app-body-gradient": "radial-gradient(ellipse 70% 45% at 14% 84%, oklch(var(--color-accent-primary) / .06), transparent 60%), var(--bg-base)",
    "app-shell-gradient": "linear-gradient(180deg, oklch(var(--color-elevated)) 0%, oklch(var(--color-canvas)) 100%)",
    "chat-overlay": "oklch(var(--color-canvas) / .92)"
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

test("global CSS compiles imported tokens and semantic Tailwind utilities", async () => {
  const globalsFile = new URL("../src/app/globals.css", import.meta.url);
  const postcssConfigFile = new URL("../postcss.config.mjs", import.meta.url);
  const [{ default: postcssConfig }, globals] = await Promise.all([
    import(postcssConfigFile.href) as Promise<{ default: { plugins: Record<string, unknown> } }>,
    readFile(globalsFile, "utf8")
  ]);
  const contentFixture = `
    <div class="bg-canvas/72 bg-aurora-primary text-content-primary border-outline bg-primary font-sans"></div>
  `;
  const plugins: AcceptedPlugin[] = [];

  for (const [pluginName, pluginOptions] of Object.entries(postcssConfig.plugins)) {
    if (pluginName === "tailwindcss") {
      plugins.push(tailwindcss({
        ...tailwindConfig,
        content: [{ raw: contentFixture, extension: "html" }]
      }));
      continue;
    }
    if (pluginName === "autoprefixer") {
      plugins.push(autoprefixer(pluginOptions as Parameters<typeof autoprefixer>[0]));
      continue;
    }

    const pluginModule = await import(pluginName) as {
      default: (options: unknown) => AcceptedPlugin;
    };
    plugins.push(pluginModule.default(pluginOptions));
  }

  const result = await postcss(plugins).process(globals, { from: fileURLToPath(globalsFile) });
  const compiled = result.css;

  assert.doesNotMatch(compiled, /@import\s/, "compiled CSS must inline token imports");
  assert.deepEqual(Object.keys(postcssConfig.plugins), ["postcss-import", "tailwindcss", "autoprefixer"]);
  for (const selector of [
    ".bg-canvas\\/72",
    ".bg-aurora-primary",
    ".text-content-primary",
    ".border-outline",
    ".bg-primary",
    ".font-sans"
  ]) {
    assert.ok(compiled.includes(selector), `missing generated selector ${selector}`);
  }
  for (const declaration of [
    "background-color: oklch(var(--color-canvas) / .72)",
    "color: oklch(var(--color-text-primary) / var(--tw-text-opacity, 1))",
    "border-color: oklch(var(--color-border-default) / var(--tw-border-opacity, 1))",
    "background-color: oklch(var(--color-accent-primary) / var(--tw-bg-opacity, 1))",
    'font-family: var(--font-space-grotesk, "Segoe UI"), Roboto, Arial, sans-serif'
  ]) {
    assert.ok(compiled.includes(declaration), `missing generated declaration: ${declaration}`);
  }
  assert.match(compiled, /--color-canvas:\s*0\.08 0 0/);
  assert.match(compiled, /--gradient-aurora-primary:\s*linear-gradient\(120deg, oklch\(var\(--color-accent-primary\)\) 0%, oklch\(var\(--color-accent-secondary\)\) 100%\)/);
  assert.match(compiled, /--shadow-glow-soft:\s*0 0 32px oklch\(var\(--color-accent-primary\) \/ \.18\)/);
  assert.match(compiled, /background-image:\s*var\(--gradient-aurora-primary\)/);
});

test("Tailwind and global CSS consume the semantic token contract", async () => {
  const [tailwindConfig, globals] = await Promise.all([
    readFile(new URL("../tailwind.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(
    tailwindConfig,
    /const tokenColor = \(token: string\) => `oklch\(var\(--color-\$\{token\}\) \/ <alpha-value>\)`;/
  );
  for (const mapping of [
    'canvas: tokenColor("canvas")',
    'primary: tokenColor("text-primary")',
    'secondary: tokenColor("text-secondary")',
    'muted: tokenColor("text-muted")',
    'disabled: tokenColor("text-disabled")',
    'subtle: tokenColor("border-subtle")',
    'DEFAULT: tokenColor("border-default")',
    'strong: tokenColor("border-strong")',
    'disabled: tokenColor("border-disabled")',
    'foreground: tokenColor("on-accent")',
    'foreground: tokenColor("on-danger")'
  ]) {
    assert.ok(tailwindConfig.includes(mapping), `missing Tailwind token mapping: ${mapping}`);
  }
  assert.match(tailwindConfig, /content:\s*\{[\s\S]*?primary:[\s\S]*?secondary:[\s\S]*?muted:[\s\S]*?disabled:/);
  assert.match(tailwindConfig, /outline:\s*\{[\s\S]*?subtle:[\s\S]*?DEFAULT:[\s\S]*?strong:[\s\S]*?disabled:/);
  assert.match(tailwindConfig, /"aurora-primary":\s*"var\(--gradient-aurora-primary\)"/);
  for (const mapping of [
    'raised: "var(--elevation-raised)"',
    'floating: "var(--elevation-floating)"',
    'glow: "var(--elevation-glow)"',
    'soft: "var(--elevation-raised)"',
    '"card-glow": "var(--elevation-floating)"',
    '"violet-hover": "var(--elevation-glow)"',
    '"violet-strong": "var(--elevation-glow)"',
    '"brand-hover": "var(--elevation-glow)"',
    '"brand-strong": "var(--elevation-glow)"',
    'inset: "var(--glass-highlight)"'
  ]) {
    assert.ok(tailwindConfig.includes(mapping), `incorrect Tailwind shadow mapping: ${mapping}`);
  }
  assert.ok(
    tailwindConfig.includes(
      'sans: [\'var(--font-space-grotesk, "Segoe UI")\', "Roboto", "Arial", "sans-serif"]'
    ),
    "font-sans must retain Segoe UI when the Space Grotesk variable is undefined"
  );
  assert.doesNotMatch(tailwindConfig, /hsl\(var\(--/);

  assert.ok(
    globals.startsWith('@import "../styles/design-tokens.css";\n'),
    "globals.css must import design-tokens.css on its first line"
  );
  assert.ok(
    globals.indexOf('@import "../styles/design-tokens.css";') < globals.indexOf("@tailwind base;"),
    "the token import must precede Tailwind directives"
  );
  assert.doesNotMatch(globals, /--background:\s*240 24% 6%/);
  assert.doesNotMatch(globals, /--color-[\w-]+\s*:/, "globals.css must not redeclare design tokens");

  const globalsAst = postcss.parse(globals);
  const activeThemeSources: string[] = [];
  globalsAst.walkAtRules("layer", (layer) => {
    if (layer.params.trim() !== "base") return;
    for (const node of layer.nodes ?? []) {
      if (node.type === "rule" && [":root", ".dark", ".light"].includes(node.selector.trim())) {
        activeThemeSources.push(node.selector.trim());
      }
    }
  });
  assert.deepEqual(activeThemeSources, [], "design-tokens.css must remain the only design token source");
  assert.match(globals, /@apply min-h-screen bg-canvas text-content-primary antialiased;/);
  assert.match(globals, /color:\s*oklch\(var\(--color-text-primary\)\);/);
});

test("the design-system reference documents every foundation contract", async () => {
  const docs = await readFile(new URL("../docs/design-system.md", import.meta.url), "utf8");

  for (const heading of [
    "Aurora Ink colors",
    "Spacing and Cloud Soft radii",
    "Space Grotesk typography",
    "Glass composition",
    "Motion presets",
    "Reduced motion",
    "Usage rules"
  ]) {
    assert.match(docs, new RegExp(`## ${heading}`));
  }

  assert.match(docs, /4 \/ 12 \/ 20 \/ 28 \/ 36 \/ full/);
  assert.match(docs, /surface\/72/);
  assert.match(docs, /springSnappy/);
  assert.match(docs, /WCAG AA/);
});
