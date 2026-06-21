# Nythera Phase 0 Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Nythera's approved Aurora Ink design tokens, Space Grotesk typography, Cloud Soft geometry, shared motion presets, and reduced-motion infrastructure without starting later visual phases or touching BYOK/provider behavior.

**Architecture:** Add one OKLCH token stylesheet as the canonical source, map it into Tailwind through semantic groups, and keep current CSS-variable names as compatibility aliases. Convert the existing runtime accent path from HSL to OKLCH, self-host Space Grotesk through `next/font/local`, then expose Motion presets and an SSR-safe reduced-motion hook without adding component animations.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS 3, TypeScript, Node test runner through `tsx --test`, Motion (`motion/react`), `next/font/local`.

---

## File map

Create:

- `src/styles/design-tokens.css` — primitive and semantic color, spacing, radius, type, elevation, glass-effect, and compatibility tokens.
- `src/lib/color/oklch.ts` — pure sRGB hex to OKLCH conversion for runtime user accents.
- `src/lib/motion.ts` — the three approved reusable transition presets.
- `src/hooks/use-prefers-reduced-motion.ts` — client-only SSR-safe reduced-motion wrapper.
- `src/assets/fonts/SpaceGrotesk-Variable.woff2` — official variable font binary.
- `src/assets/fonts/OFL.txt` — upstream license.
- `docs/design-system.md` — short canonical design-system reference.
- `tests/design-system-tokens.test.ts` — token completeness and contrast contracts.
- `tests/appearance-oklch.test.ts` — runtime accent conversion and source wiring.
- `tests/design-system-font.test.ts` — local font and metadata contract.
- `tests/motion-foundation.test.ts` — transition preset and reduced-motion contract.
- `tests/shared-primitives-design-system.test.ts` — shared primitive migration guard.

Modify:

- `tailwind.config.ts` — semantic OKLCH mappings, approved radius/type/elevation/gradient names, and legacy shadcn aliases.
- `src/app/globals.css` — import tokens, remove duplicate HSL/hex theme declarations, and strengthen reduced-motion fallback.
- `src/app/layout.tsx` — replace Google Inter with local Space Grotesk and update theme-color metadata.
- `src/components/providers/appearance-provider.tsx` — set runtime accent channels in OKLCH while retaining hex storage and favicon behavior.
- `src/components/ui/button.tsx` — consume semantic color/radius/disabled tokens without changing animation behavior.
- `src/components/ui/input.tsx` — consume semantic control and disabled tokens.
- `src/components/ui/textarea.tsx` — consume semantic control and disabled tokens.
- `src/components/ui/badge.tsx` — consume semantic surface, outline, content, and radius tokens.
- `src/components/ui/page.tsx` — consume semantic type/content/radius tokens.
- `package.json`, `package-lock.json` — add `motion`.

Explicitly out of scope:

- `src/app/api/**`
- `src/components/settings/key-settings-client.tsx`
- `src/lib/llm/**`
- `proxy-service/**`
- `prisma/**`

---

### Task 1: Lock the OKLCH token and contrast contract

**Files:**

- Create: `tests/design-system-tokens.test.ts`
- Create: `src/styles/design-tokens.css`

- [ ] **Step 1: Write the failing token contract test**

Create `tests/design-system-tokens.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tokenUrl = new URL("../src/styles/design-tokens.css", import.meta.url);

function oklchToLinearRgb([lightness, chroma, hue]: [number, number, number]) {
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
  ];
}

function luminance(color: [number, number, number]) {
  const [red, green, blue] = oklchToLinearRgb(color);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: [number, number, number], second: [number, number, number]) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function extractTheme(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match, `Missing ${selector} theme block`);
  return match[1];
}

function extractChannels(block: string, token: string): [number, number, number] {
  const match = block.match(new RegExp(`--color-${token}:\\s*([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)`));
  assert.ok(match, `Missing --color-${token}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test("design tokens define the approved semantic contract without raw legacy color functions", async () => {
  const css = await readFile(tokenUrl, "utf8");
  const required = [
    "canvas", "surface", "elevated", "text-primary", "text-secondary", "text-muted", "text-disabled",
    "border-subtle", "border-default", "border-strong", "border-disabled", "accent-primary", "accent-strong",
    "accent-secondary", "focus-ring", "danger", "warning"
  ];

  for (const token of required) {
    assert.match(css, new RegExp(`--color-${token}:`));
  }

  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i);
  assert.match(css, /--radius-compact:\s*6px/);
  assert.match(css, /--radius-control:\s*12px/);
  assert.match(css, /--radius-card:\s*20px/);
  assert.match(css, /--radius-surface:\s*28px/);
  assert.match(css, /--radius-panel:\s*36px/);
  assert.match(css, /--glass-surface-standard:\s*72%/);
  assert.match(css, /--glass-blur-md:\s*20px/);
});

test("primary, secondary, and muted text retain at least 4.5:1 contrast on every foundation surface", async () => {
  const css = await readFile(tokenUrl, "utf8");

  for (const selector of [":root, .dark", ".light"]) {
    const block = extractTheme(css, selector);
    for (const textRole of ["text-primary", "text-secondary", "text-muted"]) {
      for (const surfaceRole of ["canvas", "surface", "elevated"]) {
        const ratio = contrast(extractChannels(block, textRole), extractChannels(block, surfaceRole));
        assert.ok(ratio >= 4.5, `${selector} ${textRole} on ${surfaceRole}: ${ratio.toFixed(2)}:1`);
      }
    }
  }
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```powershell
npx tsx --test tests/design-system-tokens.test.ts
```

Expected: FAIL with `ENOENT` for `src/styles/design-tokens.css`.

- [ ] **Step 3: Add the complete canonical token stylesheet**

Create `src/styles/design-tokens.css` with the following structure and exact values:

```css
@layer base {
  :root {
    --primitive-violet-500: 0.67 0.17 286;
    --primitive-violet-600: 0.59 0.19 286;
    --primitive-mint-400: 0.87 0.12 170;
    --primitive-mint-500: 0.78 0.13 170;
    --primitive-warning-500: 0.78 0.15 80;
    --primitive-danger-500: 0.65 0.2 25;

    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;
    --space-16: 64px;

    --radius-compact: 6px;
    --radius-control: 12px;
    --radius-card: 20px;
    --radius-surface: 28px;
    --radius-panel: 36px;
    --radius-full: 9999px;

    --type-display: clamp(2.5rem, 5vw, 4.5rem);
    --type-heading-1: clamp(2rem, 3.5vw, 3.25rem);
    --type-heading-2: clamp(1.5rem, 2.5vw, 2.25rem);
    --type-heading-3: clamp(1.25rem, 1.5vw, 1.5rem);
    --type-body: clamp(0.9375rem, 0.9rem + 0.2vw, 1.0625rem);

    --glass-surface-subtle: 56%;
    --glass-surface-standard: 72%;
    --glass-surface-strong: 88%;
    --glass-border-subtle: 40%;
    --glass-border-standard: 60%;
    --glass-border-strong: 80%;
    --glass-blur-sm: 12px;
    --glass-blur-md: 20px;
    --glass-blur-lg: 28px;
    --glass-saturation: 115%;
    --glass-noise-opacity: 3.5%;
    --focus-ring-opacity: 54%;

    --gradient-aurora-primary: linear-gradient(90deg, oklch(var(--color-accent-primary)), oklch(var(--color-accent-secondary)));
    --gradient-aurora-ambient:
      radial-gradient(circle at 82% 0%, oklch(var(--color-accent-primary) / 0.18), transparent 40%),
      linear-gradient(145deg, oklch(var(--color-canvas)), oklch(var(--color-surface)) 68%, oklch(var(--color-canvas)));

    --page-padding-x: clamp(1rem, 2.8vw, 2.5rem);
    --page-padding-y: clamp(1rem, 2vw, 2rem);
    --page-max-width: 72rem;
    --content-max-width: 57.5rem;
    --chat-max-width: min(920px, calc(100vw - 2rem));
    --card-min-width: clamp(9.75rem, 42vw, 12.5rem);
    --card-height: clamp(16.5rem, 38vw, 18.75rem);
    --grid-gap: clamp(0.75rem, 1.8vw, 1.25rem);
    --bottom-nav-offset: calc(5.75rem + env(safe-area-inset-bottom));
    --touch-target: 44px;
    --sidebar-width: 260px;
    --sidebar-collapsed: 64px;

    --bg-base: oklch(var(--color-canvas));
    --bg-surface: oklch(var(--color-surface) / 0.72);
    --bg-elevated: oklch(var(--color-elevated) / 0.76);
    --bg-input: oklch(var(--color-surface) / 0.82);
    --text-primary: oklch(var(--color-text-primary));
    --text-secondary: oklch(var(--color-text-secondary));
    --text-muted: oklch(var(--color-text-muted));
    --border-default: oklch(var(--color-border-default) / 0.6);
    --border-subtle: oklch(var(--color-border-subtle) / 0.4);
    --brand-primary: oklch(var(--color-accent-primary));
    --brand-primary-hover: oklch(var(--color-accent-strong));
    --brand-secondary: oklch(var(--color-accent-secondary));
    --brand-secondary-deep: oklch(var(--primitive-violet-600));
    --accent-purple: oklch(var(--color-accent-primary));
    --accent-purple-hover: oklch(var(--color-accent-strong));
    --accent-purple-soft: oklch(var(--color-accent-primary) / 0.16);
    --accent-secondary: oklch(var(--color-accent-secondary));
    --accent-teal: oklch(var(--primitive-mint-500));
    --accent-rgb: 143 129 247;
    --bubble-user: oklch(var(--color-accent-primary) / 0.24);
    --bubble-char: oklch(var(--color-surface) / 0.72);

    --radius-sm: var(--radius-compact);
    --radius-md: var(--radius-control);
    --radius-lg: var(--radius-card);
    --radius-xl: var(--radius-surface);
    --radius-bubble: var(--radius-card);
    --radius-pill: var(--radius-full);
    --radius: var(--radius-card);

    --text-display: var(--type-display);
    --text-title: var(--type-heading-2);
    --text-subtitle: var(--type-body);
    --text-body: var(--type-body);

    --background: var(--color-canvas);
    --foreground: var(--color-text-primary);
    --card: var(--color-surface);
    --card-foreground: var(--color-text-primary);
    --popover: var(--color-elevated);
    --popover-foreground: var(--color-text-primary);
    --primary: var(--color-accent-primary);
    --primary-foreground: var(--color-canvas);
    --secondary: var(--color-elevated);
    --secondary-foreground: var(--color-text-primary);
    --muted: var(--color-surface);
    --muted-foreground: var(--color-text-secondary);
    --accent: var(--color-accent-primary);
    --accent-foreground: var(--color-canvas);
    --destructive: var(--color-danger);
    --destructive-foreground: var(--color-text-primary);
    --border: var(--color-border-default);
    --input: var(--color-surface);
    --ring: var(--color-focus-ring);
  }

  :root, .dark {
    --color-canvas: 0.115 0.027 276;
    --color-surface: 0.165 0.035 276;
    --color-elevated: 0.215 0.042 276;
    --color-text-primary: 0.96 0.012 270;
    --color-text-secondary: 0.78 0.035 270;
    --color-text-muted: 0.64 0.035 270;
    --color-text-disabled: 0.49 0.026 270;
    --color-border-subtle: 0.35 0.04 276;
    --color-border-default: 0.45 0.04 276;
    --color-border-strong: 0.6 0.04 276;
    --color-border-disabled: 0.28 0.025 276;
    --color-accent-primary: var(--primitive-violet-500);
    --color-accent-strong: var(--primitive-violet-600);
    --color-accent-secondary: var(--primitive-mint-400);
    --color-focus-ring: var(--primitive-mint-400);
    --color-warning: var(--primitive-warning-500);
    --color-danger: var(--primitive-danger-500);
    --elevation-raised: 0 14px 45px oklch(0 0 0 / 0.28);
    --elevation-floating: 0 24px 80px oklch(0 0 0 / 0.38);
    --elevation-glow: 0 0 42px oklch(var(--color-accent-primary) / 0.2);
    --glass-highlight: inset 0 1px 0 oklch(var(--color-text-primary) / 0.08);
    --shadow-soft: var(--elevation-raised);
    --shadow-card: var(--elevation-floating);
    --shadow-glow: var(--elevation-glow);
    --shadow-glow-soft: 0 0 84px oklch(var(--color-accent-primary) / 0.11);
    --app-body-gradient: var(--gradient-aurora-ambient);
    --app-shell-gradient: var(--gradient-aurora-ambient);
    --chat-overlay: linear-gradient(180deg, oklch(var(--color-canvas) / 0.66), oklch(var(--color-canvas) / 0.9) 34%, oklch(var(--color-canvas)));
  }

  .light {
    --color-canvas: 0.965 0.012 270;
    --color-surface: 0.988 0.004 270;
    --color-elevated: 0.999 0 0;
    --color-text-primary: 0.22 0.04 275;
    --color-text-secondary: 0.42 0.045 275;
    --color-text-muted: 0.48 0.04 275;
    --color-text-disabled: 0.65 0.025 275;
    --color-border-subtle: 0.82 0.03 275;
    --color-border-default: 0.72 0.035 275;
    --color-border-strong: 0.55 0.04 275;
    --color-border-disabled: 0.88 0.015 275;
    --color-accent-primary: var(--primitive-violet-500);
    --color-accent-strong: var(--primitive-violet-600);
    --color-accent-secondary: var(--primitive-mint-400);
    --color-focus-ring: var(--primitive-violet-600);
    --color-warning: var(--primitive-warning-500);
    --color-danger: var(--primitive-danger-500);
    --glass-noise-opacity: 2.5%;
    --elevation-raised: 0 12px 36px oklch(0.35 0.04 275 / 0.1);
    --elevation-floating: 0 18px 60px oklch(0.35 0.04 275 / 0.12);
    --elevation-glow: 0 0 34px oklch(var(--color-accent-primary) / 0.16);
    --glass-highlight: inset 0 1px 0 oklch(var(--color-elevated) / 0.72);
    --shadow-soft: var(--elevation-raised);
    --shadow-card: var(--elevation-floating);
    --shadow-glow: var(--elevation-glow);
    --shadow-glow-soft: 0 0 74px oklch(var(--color-accent-primary) / 0.1);
    --app-body-gradient: var(--gradient-aurora-ambient);
    --app-shell-gradient: var(--gradient-aurora-ambient);
    --chat-overlay: linear-gradient(180deg, oklch(var(--color-canvas) / 0.7), oklch(var(--color-canvas) / 0.9) 34%, oklch(var(--color-canvas)));
  }
}
```

- [ ] **Step 4: Run the token test and verify it passes**

Run:

```powershell
npx tsx --test tests/design-system-tokens.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the token contract**

```powershell
git add src/styles/design-tokens.css tests/design-system-tokens.test.ts
git commit -m "Add Aurora Ink design tokens"
```

---

### Task 2: Wire semantic tokens into Tailwind and global CSS

**Files:**

- Modify: `tests/design-system-tokens.test.ts`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add a failing Tailwind/global wiring test**

Append to `tests/design-system-tokens.test.ts`:

```ts
test("Tailwind and global CSS consume the canonical token layer", async () => {
  const [tailwind, globals] = await Promise.all([
    readFile(new URL("../tailwind.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")
  ]);

  assert.match(tailwind, /oklch\(var\(--color-/);
  assert.match(tailwind, /content:\s*\{/);
  assert.match(tailwind, /outline:\s*\{/);
  assert.match(tailwind, /"aurora-primary"/);
  assert.doesNotMatch(tailwind, /hsl\(var\(--/);
  assert.match(globals, /@import "\.\.\/styles\/design-tokens\.css";/);
  assert.doesNotMatch(globals, /--background:\s*240 24% 6%/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npx tsx --test tests/design-system-tokens.test.ts
```

Expected: FAIL because Tailwind still uses HSL and globals does not import the token file.

- [ ] **Step 3: Replace Tailwind's HSL mappings with semantic OKLCH mappings**

Add this helper above `config` in `tailwind.config.ts`:

```ts
const tokenColor = (token: string) => `oklch(var(--color-${token}) / <alpha-value>)`;
```

Replace `extend.colors`, `borderRadius`, and `boxShadow`, and add font/type/gradient mappings:

```ts
colors: {
  canvas: tokenColor("canvas"),
  surface: tokenColor("surface"),
  elevated: tokenColor("elevated"),
  content: {
    primary: tokenColor("text-primary"),
    secondary: tokenColor("text-secondary"),
    muted: tokenColor("text-muted"),
    disabled: tokenColor("text-disabled")
  },
  outline: {
    subtle: tokenColor("border-subtle"),
    DEFAULT: tokenColor("border-default"),
    strong: tokenColor("border-strong"),
    disabled: tokenColor("border-disabled")
  },
  brand: {
    DEFAULT: tokenColor("accent-primary"),
    strong: tokenColor("accent-strong"),
    secondary: tokenColor("accent-secondary"),
    soft: "oklch(var(--color-accent-primary) / 0.16)"
  },
  warning: tokenColor("warning"),
  danger: tokenColor("danger"),
  border: tokenColor("border-default"),
  input: tokenColor("surface"),
  ring: tokenColor("focus-ring"),
  background: tokenColor("canvas"),
  foreground: tokenColor("text-primary"),
  primary: {
    DEFAULT: tokenColor("accent-primary"),
    foreground: tokenColor("canvas")
  },
  secondary: {
    DEFAULT: tokenColor("elevated"),
    foreground: tokenColor("text-primary")
  },
  destructive: {
    DEFAULT: tokenColor("danger"),
    foreground: tokenColor("text-primary")
  },
  muted: {
    DEFAULT: tokenColor("surface"),
    foreground: tokenColor("text-secondary")
  },
  accent: {
    DEFAULT: tokenColor("accent-primary"),
    foreground: tokenColor("canvas")
  },
  card: {
    DEFAULT: tokenColor("surface"),
    foreground: tokenColor("text-primary")
  }
},
fontFamily: {
  sans: ["var(--font-space-grotesk)", "Segoe UI", "Roboto", "Arial", "sans-serif"]
},
opacity: {
  40: "0.4",
  56: "0.56",
  60: "0.6",
  72: "0.72",
  80: "0.8",
  88: "0.88"
},
fontSize: {
  display: ["var(--type-display)", { lineHeight: "0.98", letterSpacing: "-0.052em" }],
  "heading-1": ["var(--type-heading-1)", { lineHeight: "1.02", letterSpacing: "-0.045em" }],
  "heading-2": ["var(--type-heading-2)", { lineHeight: "1.08", letterSpacing: "-0.035em" }],
  "heading-3": ["var(--type-heading-3)", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
  body: ["var(--type-body)", { lineHeight: "1.6" }]
},
borderRadius: {
  compact: "var(--radius-compact)",
  control: "var(--radius-control)",
  card: "var(--radius-card)",
  surface: "var(--radius-surface)",
  panel: "var(--radius-panel)",
  full: "var(--radius-full)",
  lg: "var(--radius-card)",
  md: "var(--radius-control)",
  sm: "var(--radius-compact)"
},
backgroundImage: {
  "aurora-primary": "var(--gradient-aurora-primary)",
  "aurora-ambient": "var(--gradient-aurora-ambient)"
},
boxShadow: {
  raised: "var(--elevation-raised)",
  floating: "var(--elevation-floating)",
  glow: "var(--elevation-glow)",
  soft: "var(--elevation-raised)",
  "card-glow": "var(--elevation-floating)",
  "violet-hover": "var(--elevation-glow)",
  "violet-strong": "var(--elevation-glow)",
  "brand-hover": "var(--elevation-glow)",
  "brand-strong": "var(--elevation-glow)",
  inset: "var(--glass-highlight)"
}
```

- [ ] **Step 4: Import tokens and remove duplicate theme declarations from globals**

Place this before the Tailwind directives in `src/app/globals.css`:

```css
@import "../styles/design-tokens.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Delete the existing `:root`, `.dark`, and `.light` variable blocks inside `@layer base`. Keep responsive layout media queries, color-scheme rules, base element rules, components, utilities, and keyframes. Update `body` to keep the existing utility aliases while using canonical colors:

```css
body {
  @apply min-h-screen bg-canvas text-content-primary antialiased;
  min-height: 100dvh;
  background: var(--app-body-gradient);
  color: oklch(var(--color-text-primary));
  -webkit-tap-highlight-color: transparent;
  text-rendering: optimizeLegibility;
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

- [ ] **Step 5: Run focused and build-level checks**

```powershell
npx tsx --test tests/design-system-tokens.test.ts
npm run typecheck
npm run build
```

Expected: token tests PASS, typecheck exits 0, production build completes.

- [ ] **Step 6: Commit Tailwind/global wiring**

```powershell
git add tailwind.config.ts src/app/globals.css tests/design-system-tokens.test.ts
git commit -m "Wire semantic tokens into Tailwind"
```

---

### Task 3: Preserve runtime custom accents with OKLCH channels

**Files:**

- Create: `tests/appearance-oklch.test.ts`
- Create: `src/lib/color/oklch.ts`
- Modify: `src/components/providers/appearance-provider.tsx`

- [ ] **Step 1: Write failing conversion and source-wiring tests**

Create `tests/appearance-oklch.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hex accents convert to stable OKLCH channels", async () => {
  const color = await import("../src/lib/color/oklch").catch(() => null);
  assert.equal(typeof color?.hexToOklch, "function");
  assert.equal(typeof color?.formatOklchChannels, "function");

  const violet = color!.hexToOklch("#8F81F7");
  assert.ok(Math.abs(violet.lightness - 0.67) < 0.01);
  assert.ok(Math.abs(violet.chroma - 0.17) < 0.01);
  assert.ok(Math.abs(violet.hue - 286) < 1);
  assert.equal(color!.formatOklchChannels(color!.hexToOklch("#FFFFFF")), "1.000000 0.000000 0.000");
});

test("appearance provider writes OKLCH semantic channels without restoring HSL", async () => {
  const source = await readFile(new URL("../src/components/providers/appearance-provider.tsx", import.meta.url), "utf8");
  assert.match(source, /--color-accent-primary/);
  assert.match(source, /formatOklchChannels/);
  assert.doesNotMatch(source, /rgbToHsl|--primary[^\n]*%/);
  assert.match(source, /DEFAULT_ACCENT_COLOR = "#8F81F7"/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npx tsx --test tests/appearance-oklch.test.ts
```

Expected: FAIL because `src/lib/color/oklch.ts` does not exist.

- [ ] **Step 3: Implement the pure conversion utility**

Create `src/lib/color/oklch.ts`:

```ts
export type OklchColor = {
  lightness: number;
  chroma: number;
  hue: number;
};

function srgbToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function hexToOklch(hexColor: string): OklchColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) {
    throw new TypeError(`Expected a six-digit hex color, received ${hexColor}`);
  }

  const red = srgbToLinear(Number.parseInt(hexColor.slice(1, 3), 16));
  const green = srgbToLinear(Number.parseInt(hexColor.slice(3, 5), 16));
  const blue = srgbToLinear(Number.parseInt(hexColor.slice(5, 7), 16));
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a * a + b * b);
  const hue = chroma < 0.000001 ? 0 : (Math.atan2(b, a) * 180) / Math.PI;

  return {
    lightness,
    chroma,
    hue: hue < 0 ? hue + 360 : hue
  };
}

export function formatOklchChannels(color: OklchColor) {
  return `${color.lightness.toFixed(6)} ${color.chroma.toFixed(6)} ${color.hue.toFixed(3)}`;
}
```

- [ ] **Step 4: Rewire `applyAccentColor` to semantic OKLCH channels**

In `src/components/providers/appearance-provider.tsx`:

1. Import `formatOklchChannels` and `hexToOklch` from `@/lib/color/oklch`.
2. Change `DEFAULT_ACCENT_COLOR` to `#8F81F7`.
3. Replace `applyAccentColor` with:

```ts
export function applyAccentColor(hexColor: string) {
  if (typeof document === "undefined" || !isHexColor(hexColor)) {
    return;
  }

  const rgb = hexToRgb(hexColor);
  const hover = mixWith(rgb, 0, 0, 0, 0.14);
  const primaryChannels = formatOklchChannels(hexToOklch(hexColor));
  const strongChannels = formatOklchChannels(hexToOklch(rgbToHex(hover)));
  const root = document.documentElement;

  root.style.setProperty("--color-accent-primary", primaryChannels);
  root.style.setProperty("--color-accent-strong", strongChannels);
  root.style.setProperty("--primary", primaryChannels);
  root.style.setProperty("--accent", primaryChannels);
  root.style.setProperty("--ring", primaryChannels);
  root.style.setProperty("--brand-primary", `oklch(${primaryChannels})`);
  root.style.setProperty("--brand-primary-hover", `oklch(${strongChannels})`);
  root.style.setProperty("--brand-glow", `oklch(${primaryChannels} / 0.15)`);
  root.style.setProperty("--brand-glow-strong", `oklch(${primaryChannels} / 0.28)`);
  root.style.setProperty("--accent-purple", `oklch(${primaryChannels})`);
  root.style.setProperty("--accent-purple-hover", `oklch(${strongChannels})`);
  root.style.setProperty("--accent-purple-soft", `oklch(${primaryChannels} / 0.16)`);
  root.style.setProperty("--accent-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
  root.style.setProperty("--bubble-user", `oklch(${primaryChannels} / 0.24)`);
  updateDynamicFavicon(hexColor);
}
```

Delete the unused `rgbToHsl` function. Keep hex storage, account sync, preset selection, RGB compatibility channels, and favicon generation unchanged.

- [ ] **Step 5: Run focused and existing appearance-adjacent tests**

```powershell
npx tsx --test tests/appearance-oklch.test.ts tests/branding-icons.test.ts
npm run typecheck
```

Expected: all focused tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit the runtime accent migration**

```powershell
git add src/lib/color/oklch.ts src/components/providers/appearance-provider.tsx tests/appearance-oklch.test.ts
git commit -m "Preserve custom accents with OKLCH"
```

---

### Task 4: Self-host Space Grotesk and update theme metadata

**Files:**

- Create: `tests/design-system-font.test.ts`
- Create: `src/assets/fonts/SpaceGrotesk-Variable.woff2`
- Create: `src/assets/fonts/OFL.txt`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/providers/appearance-provider.tsx`

- [ ] **Step 1: Write the failing local-font contract test**

Create `tests/design-system-font.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Space Grotesk is local, variable, licensed, and wired through next/font/local", async () => {
  const [layout, font, license] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/assets/fonts/SpaceGrotesk-Variable.woff2", import.meta.url)),
    readFile(new URL("../src/assets/fonts/OFL.txt", import.meta.url), "utf8")
  ]);

  assert.equal(font.toString("ascii", 0, 4), "wOF2");
  assert.match(license, /SIL OPEN FONT LICENSE/i);
  assert.match(layout, /localFont/);
  assert.match(layout, /SpaceGrotesk-Variable\.woff2/);
  assert.match(layout, /weight:\s*"300 700"/);
  assert.match(layout, /--font-space-grotesk/);
  assert.doesNotMatch(layout, /next\/font\/google|\bInter\(/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npx tsx --test tests/design-system-font.test.ts
```

Expected: FAIL with `ENOENT` for the font asset.

- [ ] **Step 3: Download the official font and license**

Run from the repository root:

```powershell
New-Item -ItemType Directory -Force src\assets\fonts | Out-Null
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/floriankarsten/space-grotesk/03507d024a01282884232081fc6011c09ff4e849/fonts/woff2/SpaceGrotesk%5Bwght%5D.woff2' -OutFile 'src\assets\fonts\SpaceGrotesk-Variable.woff2'
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/floriankarsten/space-grotesk/03507d024a01282884232081fc6011c09ff4e849/OFL.txt' -OutFile 'src\assets\fonts\OFL.txt'
```

The source is the official Space Grotesk repository, release line 2.0.0.

- [ ] **Step 4: Replace Google Inter with local Space Grotesk**

In `src/app/layout.tsx`, replace the font import and declaration with:

```ts
import localFont from "next/font/local";

const spaceGrotesk = localFont({
  src: "../assets/fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  style: "normal",
  display: "swap",
  fallback: ["Segoe UI", "Roboto", "Arial", "sans-serif"]
});
```

Use this body class:

```tsx
<body className={`${spaceGrotesk.className} ${spaceGrotesk.variable} min-h-screen overflow-x-hidden`}>
```

Update viewport metadata to the sRGB equivalents of the approved canvas tokens:

```ts
themeColor: [
  { media: "(prefers-color-scheme: dark)", color: "#03040F" },
  { media: "(prefers-color-scheme: light)", color: "#F0F3FC" }
]
```

Update the same two theme-color values in `updateDynamicFavicon` inside `appearance-provider.tsx`; metadata hex is an approved browser-compatibility exception.

- [ ] **Step 5: Run font, branding, type, and build checks**

```powershell
npx tsx --test tests/design-system-font.test.ts tests/branding-icons.test.ts
npm run typecheck
npm run build
```

Expected: tests PASS, typecheck exits 0, build completes with local font output and no Google font fetch.

- [ ] **Step 6: Commit local typography**

```powershell
git add src/assets/fonts src/app/layout.tsx src/components/providers/appearance-provider.tsx tests/design-system-font.test.ts
git commit -m "Self-host Space Grotesk typography"
```

---

### Task 5: Add Motion presets and reduced-motion infrastructure

**Files:**

- Create: `tests/motion-foundation.test.ts`
- Create: `src/lib/motion.ts`
- Create: `src/hooks/use-prefers-reduced-motion.ts`
- Modify: `src/app/globals.css`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing motion contract test**

Create `tests/motion-foundation.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("motion exposes only the approved reusable presets", async () => {
  const motion = await import("../src/lib/motion").catch(() => null);
  assert.deepEqual(motion?.springSnappy, { type: "spring", stiffness: 420, damping: 32, mass: 0.75 });
  assert.deepEqual(motion?.springSoft, { type: "spring", stiffness: 220, damping: 28, mass: 0.9 });
  assert.deepEqual(motion?.easeStandard, { duration: 0.22, ease: [0.2, 0, 0, 1] });
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
  assert.match(globals, /scroll-behavior:\s*auto\s*!important/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npx tsx --test tests/motion-foundation.test.ts
```

Expected: FAIL because `src/lib/motion.ts` and the shared hook do not exist.

- [ ] **Step 3: Install Motion**

```powershell
npm install motion
```

Expected: `motion` is added to dependencies and the lockfile updates without peer dependency errors.

- [ ] **Step 4: Add the approved presets**

Create `src/lib/motion.ts`:

```ts
import type { Transition } from "motion/react";

export const springSnappy = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.75
} satisfies Transition;

export const springSoft = {
  type: "spring",
  stiffness: 220,
  damping: 28,
  mass: 0.9
} satisfies Transition;

export const easeStandard = {
  duration: 0.22,
  ease: [0.2, 0, 0, 1]
} satisfies Transition;
```

- [ ] **Step 5: Add the shared reduced-motion hook**

Create `src/hooks/use-prefers-reduced-motion.ts`:

```ts
"use client";

import { useReducedMotion } from "motion/react";

export function usePrefersReducedMotion() {
  return useReducedMotion() ?? true;
}
```

- [ ] **Step 6: Strengthen the existing global reduced-motion safety net**

In the existing `@media (prefers-reduced-motion: reduce)` block in `src/app/globals.css`, replace `1ms` with `0.01ms` for both animation and transition duration. Keep iteration count at 1 and both `html` and universal `scroll-behavior: auto` declarations.

- [ ] **Step 7: Run focused and compile checks**

```powershell
npx tsx --test tests/motion-foundation.test.ts
npm run typecheck
npm run build
```

Expected: motion tests PASS, typecheck exits 0, build completes. No component imports Motion yet, so no new page animation is present.

- [ ] **Step 8: Commit motion infrastructure**

```powershell
git add package.json package-lock.json src/lib/motion.ts src/hooks/use-prefers-reduced-motion.ts src/app/globals.css tests/motion-foundation.test.ts
git commit -m "Add shared motion accessibility foundation"
```

---

### Task 6: Migrate shared primitives without starting Phase 1 or Phase 3

**Files:**

- Create: `tests/shared-primitives-design-system.test.ts`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing shared-primitives source contract**

Create `tests/shared-primitives-design-system.test.ts`:

```ts
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

test("Phase 0 does not introduce Motion components or replace existing interaction behavior", async () => {
  const source = await readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from "motion\/react"|motion\./);
  assert.match(source, /active:scale-95/);
  assert.doesNotMatch(source, /sm:\s*"h-9/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npx tsx --test tests/shared-primitives-design-system.test.ts
```

Expected: FAIL because shared primitives still use compatibility variables.

- [ ] **Step 3: Migrate `Button` classes while preserving behavior and variants**

Keep the component API, CVA variants, sizes, transition classes, and active transforms unchanged. Replace class strings with:

```ts
const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold no-underline transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100",
  {
    variants: {
      variant: {
        primary:
          "border border-outline-subtle bg-aurora-primary text-primary-foreground shadow-glow hover:-translate-y-0.5 hover:shadow-glow",
        secondary:
          "border border-outline bg-elevated text-content-primary shadow-raised backdrop-blur-xl hover:-translate-y-0.5 hover:border-outline-strong",
        ghost:
          "text-content-secondary hover:bg-surface/56 hover:text-content-primary",
        outline:
          "border border-outline bg-surface text-content-primary shadow-raised backdrop-blur-xl hover:-translate-y-0.5 hover:border-outline-strong",
        destructive:
          "border border-danger/30 bg-danger/15 text-content-primary hover:-translate-y-0.5 hover:bg-danger/25"
      },
      size: {
        sm: "h-11 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11 px-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);
```

The existing CSS transition remains until Phase 3; this task does not claim it is Motion-driven.

- [ ] **Step 4: Migrate controls, badge, and page typography**

Use these canonical class strings:

`Input`:

```ts
"focus-ring glass-input flex h-12 w-full rounded-control border-outline px-4 py-2 text-sm text-content-primary placeholder:text-content-muted disabled:cursor-not-allowed disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100 focus:border-brand"
```

`Textarea`:

```ts
"focus-ring glass-input min-h-28 w-full resize-y rounded-control border-outline px-4 py-3 text-sm leading-6 text-content-primary placeholder:text-content-muted disabled:cursor-not-allowed disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100 focus:border-brand"
```

`Badge`:

```ts
"inline-flex items-center rounded-full border border-outline bg-surface/56 px-3 py-1 text-xs font-medium text-content-secondary shadow-raised backdrop-blur-xl"
```

In `src/components/ui/page.tsx`, make these exact class replacements without changing markup, responsive breakpoints, or layout structure:

```text
rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)]
→ rounded-control border border-outline bg-brand-soft text-brand shadow-raised

text-display max-w-4xl font-semibold tracking-tight text-[var(--text-primary)]
→ text-display max-w-4xl font-semibold text-content-primary

text-subtitle mt-2 max-w-2xl text-[var(--text-secondary)]
→ text-body mt-2 max-w-2xl text-content-secondary

text-title font-semibold tracking-tight text-[var(--text-primary)]
→ text-heading-2 font-semibold text-content-primary

text-subtitle mt-1 max-w-2xl text-[var(--text-secondary)]
→ text-body mt-1 max-w-2xl text-content-secondary
```

Update `.glass-input` in `src/app/globals.css` to consume only semantic variables:

```css
.glass-input {
  @apply border text-content-primary placeholder:text-content-muted transition duration-200;
  border-color: oklch(var(--color-border-default) / var(--glass-border-standard));
  background: oklch(var(--color-surface) / var(--glass-surface-strong));
  box-shadow: var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur-md));
}
```

Also replace `.focus-ring:focus-visible` with the semantic focus channel while preserving the existing ring geometry:

```css
.focus-ring:focus-visible {
  box-shadow:
    0 0 0 2px oklch(var(--color-canvas)),
    0 0 0 4px oklch(var(--ring) / var(--focus-ring-opacity)),
    var(--elevation-glow);
}
```

Do not migrate feature-specific glass panels or cards; those belong to Phase 1.

- [ ] **Step 5: Run primitive and full UI regression tests**

```powershell
npx tsx --test tests/shared-primitives-design-system.test.ts tests/chat-ui-regressions.test.ts tests/round2-ui-overflow.test.ts
npm run typecheck
npm run lint
```

Expected: focused tests PASS, existing UI regression tests PASS, typecheck/lint exit 0.

- [ ] **Step 6: Commit shared primitive migration**

```powershell
git add src/components/ui src/app/globals.css tests/shared-primitives-design-system.test.ts
git commit -m "Migrate shared primitives to semantic tokens"
```

---

### Task 7: Publish the canonical design-system reference

**Files:**

- Create: `docs/design-system.md`
- Modify: `tests/design-system-tokens.test.ts`

- [ ] **Step 1: Add a failing documentation completeness test**

Append to `tests/design-system-tokens.test.ts`:

```ts
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
  assert.match(docs, /6 \/ 12 \/ 20 \/ 28 \/ 36 \/ full/);
  assert.match(docs, /surface\/72/);
  assert.match(docs, /springSnappy/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npx tsx --test tests/design-system-tokens.test.ts
```

Expected: FAIL with `ENOENT` for `docs/design-system.md`.

- [ ] **Step 3: Create the concise reference**

Create `docs/design-system.md` with this exact outline and content:

```md
# Nythera Design System

Aurora Ink is Nythera's canonical visual foundation. Both dark and light themes are first-class. Token definitions live in `src/styles/design-tokens.css`; this document explains their intended use.

## Aurora Ink colors

- Canvas, surface, and elevated are semantic theme surfaces.
- Content primary, secondary, muted, and disabled are the only text roles.
- Brand uses violet as the primary accent and mint as the secondary accent.
- Use semantic Tailwind groups (`canvas`, `surface`, `elevated`, `content`, `outline`, `brand`) rather than primitive colors.
- Runtime user accents may override the primary brand channel through the approved hex-to-OKLCH utility.

## Spacing and Cloud Soft radii

- Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px.
- Radius: 6 / 12 / 20 / 28 / 36 / full.
- 6px is reserved for compact controls and internal geometry. General surfaces start at 12px.
- Minimum interactive target: 44px.

## Space Grotesk typography

- Space Grotesk Variable is self-hosted at weights 300–700; UI uses 400/500/600/700.
- Display, h1, h2, h3, and body use named fluid tokens.
- Cyrillic falls back to Segoe UI, Roboto, Arial, then sans-serif.

## Glass composition

- Glass colors come from semantic utilities such as `surface/72` and matching `outline` opacity levels; never create glass-specific colors.
- Allowed surface opacity levels are 56%, 72%, and 88%; allowed border levels are 40%, 60%, and 80%.
- Allowed blur values are 12px, 20px, and 28px; saturation is 115%.
- Tablet/mobile fallback keeps the semantic surface, raises opacity, and removes blur.

## Motion presets

- `springSnappy`: compact interactions.
- `springSoft`: messages, cards, and layout movement.
- `easeStandard`: opacity/color transitions and non-spring fallback.
- Do not create component-local durations or curves.

## Reduced motion

- Read preference through `usePrefersReducedMotion`.
- Reduced mode disables transform, scale, blur, parallax, loops, and smooth scrolling.
- State changes remain immediate and comprehensible.

## Usage rules

- No raw hex/HSL/RGB in design-system styling. Metadata, image data, and user-selected runtime colors are explicit exceptions.
- No arbitrary spacing, radius, or motion values in new visual work.
- Later phases migrate every surface they touch and preserve mobile/tablet behavior.
- Provider/BYOK behavior is outside the visual design system.
```

- [ ] **Step 4: Run the documentation contract test**

```powershell
npx tsx --test tests/design-system-tokens.test.ts
```

Expected: all token/documentation tests PASS.

- [ ] **Step 5: Commit the reference**

```powershell
git add docs/design-system.md tests/design-system-tokens.test.ts
git commit -m "Document the Nythera design system"
```

---

### Task 8: Run the full regression and scope gate

**Files:**

- No planned source changes; fix only failures caused by Phase 0 and commit those fixes separately.

- [ ] **Step 1: Verify the complete automated suite**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run proxy:build
npm run build
```

Expected:

- All existing and new Node tests PASS.
- TypeScript exits 0.
- Next lint exits 0.
- Proxy build exits 0 without provider changes.
- Next production build completes.

- [ ] **Step 2: Verify no forbidden subsystem changed**

Run:

```powershell
$forbidden = git diff main...HEAD --name-only | Select-String -Pattern '^(prisma/|proxy-service/|src/app/api/|src/components/settings/key-settings-client\.tsx|src/lib/llm/)'
if ($forbidden) { $forbidden; throw 'Phase 0 touched forbidden provider/backend scope' }
git diff main...HEAD --check
```

Expected: no forbidden paths and no whitespace errors.

- [ ] **Step 3: Inspect production output for font and Motion regressions**

Run:

```powershell
rg -n "fonts.googleapis.com|next/font/google" .next src
rg -n "motion/react" src
```

Expected: no Google font references; `motion/react` appears only in the shared preset type import and reduced-motion hook, not in page/component rendering code.

- [ ] **Step 4: Commit only if verification required corrective changes**

```powershell
git add src/styles/design-tokens.css tailwind.config.ts src/app/globals.css src/app/layout.tsx src/components/providers/appearance-provider.tsx src/lib/color/oklch.ts src/lib/motion.ts src/hooks/use-prefers-reduced-motion.ts src/components/ui docs/design-system.md tests package.json package-lock.json
git diff --cached --name-only
git commit -m "Fix Phase 0 verification regressions"
```

Before committing, confirm the staged list contains only the Phase 0 paths named in the file map. If no correction was needed, do not run these commands or create an empty commit.

---

### Task 9: Browser matrix, preview deployment, and Phase 0 handoff

**Files:**

- No planned source changes; visual fixes found here must receive their own failing regression test and commit.

- [ ] **Step 1: Start the production server locally**

```powershell
npm run build
$process = Start-Process npm.cmd -ArgumentList 'start' -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
Write-Output "SERVER_PID=$($process.Id)"
Start-Sleep -Seconds 3
(Invoke-WebRequest -UseBasicParsing 'http://localhost:3000' -TimeoutSec 10).StatusCode
```

Expected: `http://localhost:3000` responds with HTTP 200.

- [ ] **Step 2: Perform the browser viewport matrix**

Use Chromium, Firefox, and WebKit-capable browser tooling and inspect `/explore`, `/chats`, `/settings`, `/create-character`, and one `/chat/[id]` route in dark and light themes.

Required profiles:

| Profile | Viewport | Checks |
|---|---|---|
| iPhone Safari profile | 390×844 | No horizontal overflow; fallback font readable; changed/shared controls retain 44px targets |
| Android Chrome | 412×915 | Same plus theme toggle and accent update |
| iPad portrait | 768×1024, 810×1080, 834×1194 | Existing tablet single-pane/chat avatar behavior unchanged |
| iPad landscape | 1024×768, 1080×810, 1194×834 | No desktop pane overlap; navigation remains usable |
| Desktop Chrome | 1440×900 | Dark/light surfaces and Space Grotesk load correctly |
| Desktop Firefox | 1440×900 | OKLCH colors, focus rings, and local font render correctly |

With reduced motion enabled, confirm smooth scrolling is disabled and existing looping auth/loading/message entrance animations do not loop. Do not claim real iOS Safari passed from Windows; record it as awaiting device smoke-test.

- [ ] **Step 3: Stop the local server**

```powershell
$owner = (Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1).OwningProcess
Stop-Process -Id $owner
```

- [ ] **Step 4: Push the dedicated branch**

```powershell
git push -u origin christopher/phase-0-design-system
```

Expected: remote branch is created successfully.

- [ ] **Step 5: Open the dedicated Phase 0 pull request**

```powershell
gh pr create --base main --head christopher/phase-0-design-system --title "Phase 0: establish Nythera design system" --body "Establishes Aurora Ink OKLCH tokens, self-hosted Space Grotesk, Cloud Soft geometry, shared Motion presets, and reduced-motion infrastructure. Does not touch BYOK/provider/backend behavior and does not start Phase 1 glass rollout."
```

Expected: GitHub returns a pull-request URL targeting `main`.

- [ ] **Step 6: Create a Vercel preview deployment, not production**

```powershell
vercel --yes
```

Expected: Vercel returns a preview URL. Verify `/explore`, `/settings`, and one chat route on the preview.

- [ ] **Step 7: Hand off Phase 0 for confirmation**

Report:

- Branch and commit list.
- Pull-request URL.
- Automated verification results.
- Preview URL.
- Viewport/browser results, clearly separating emulated WebKit from real iOS Safari.
- Confirmation that forbidden BYOK/provider/backend paths are absent from the diff.
- Real-device iPhone/iPad Safari smoke-test status.

Do not begin Phase 1 until Phase 0 is explicitly confirmed.
