import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadOklch() {
  return import("../src/lib/color/oklch");
}

test("hexToOklch converts the Aurora violet accent", async () => {
  const { hexToOklch } = await loadOklch();
  const color = hexToOklch("#8F81F7");

  assert.ok(Math.abs(color.lightness - 0.67) <= 0.01);
  assert.ok(Math.abs(color.chroma - 0.17) <= 0.01);
  assert.ok(Math.abs(color.hue - 286) <= 1);
});

test("formatOklchChannels emits fixed-precision white channels", async () => {
  const { formatOklchChannels, hexToOklch } = await loadOklch();

  assert.equal(formatOklchChannels(hexToOklch("#FFFFFF")), "1.000000 0.000000 0.000");
});

test("black and neutral colors use a zero hue", async () => {
  const { hexToOklch } = await loadOklch();

  assert.deepEqual(hexToOklch("#000000"), { lightness: 0, chroma: 0, hue: 0 });
  assert.equal(hexToOklch("#808080").hue, 0);
});

test("hexToOklch rejects anything except six-digit hex colors", async () => {
  const { hexToOklch } = await loadOklch();

  for (const invalid of ["#FFF", "FFFFFF", "#GGGGGG", "#12345678", ""] as const) {
    assert.throws(
      () => hexToOklch(invalid),
      (error: unknown) => error instanceof TypeError && error.message.includes(invalid),
      `expected ${JSON.stringify(invalid)} to be rejected with its received value`
    );
  }
});

test("appearance provider applies custom accents as OKLCH channels", async () => {
  const source = await readFile(
    new URL("../src/components/providers/appearance-provider.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /import\s+\{\s*formatOklchChannels\s*,?\s*hexToOklch\s*\}\s+from\s+["']@\/lib\/color\/oklch["']/);
  assert.match(source, /const primaryChannels = formatOklchChannels\(hexToOklch\(hexColor\)\);/);
  assert.match(source, /const strongChannels = formatOklchChannels\(hexToOklch\(rgbToHex\(hover\)\)\);/);

  for (const assignment of [
    'root.style.setProperty("--color-accent-primary", primaryChannels);',
    'root.style.setProperty("--color-accent-strong", strongChannels);',
    'root.style.setProperty("--primary", primaryChannels);',
    'root.style.setProperty("--accent", primaryChannels);',
    'root.style.setProperty("--ring", primaryChannels);',
    'root.style.setProperty("--brand-primary", `oklch(${primaryChannels})`);',
    'root.style.setProperty("--brand-primary-hover", `oklch(${strongChannels})`);',
    'root.style.setProperty("--brand-glow", `oklch(${primaryChannels} / .15)`);',
    'root.style.setProperty("--brand-glow-strong", `oklch(${primaryChannels} / .28)`);',
    'root.style.setProperty("--accent-purple", `oklch(${primaryChannels})`);',
    'root.style.setProperty("--accent-purple-hover", `oklch(${strongChannels})`);',
    'root.style.setProperty("--accent-purple-soft", `oklch(${primaryChannels} / .16)`);',
    'root.style.setProperty("--bubble-user", `oklch(${primaryChannels} / .24)`);'
  ]) {
    assert.ok(source.includes(assignment), `missing runtime OKLCH assignment: ${assignment}`);
  }

  assert.doesNotMatch(source, /rgbToHsl/);
  assert.doesNotMatch(source, /setProperty\(["']--(?:primary|accent|ring)["'],\s*`[^`]*%/);
  assert.doesNotMatch(source, /setProperty\(["']--color-accent-secondary["']/);
});

test("appearance provider retains custom accent compatibility and synchronization", async () => {
  const source = await readFile(
    new URL("../src/components/providers/appearance-provider.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /export const DEFAULT_ACCENT_COLOR = ["']#8F81F7["'];/);
  for (const preset of ["#8F81F7", "#6EE7D8", "#A78BFA", "#2DD4BF", "#EF476F", "#38BDF8", "#F472B6", "#64748B"]) {
    assert.ok(source.includes(`"${preset}"`), `missing existing accent preset ${preset}`);
  }
  for (const retained of [
    "readStoredAppearance",
    "saveStoredAppearance",
    "syncAppearanceFromAccount",
    "persistAccountAppearance",
    "APPEARANCE_UPDATED_EVENT",
    "BRAND_STATE_EVENT",
    'fetch("/api/profile"',
    "window.localStorage.getItem",
    "window.localStorage.setItem"
  ]) {
    assert.ok(source.includes(retained), `missing retained appearance behavior: ${retained}`);
  }

  assert.match(source, /const hover = mixWith\(rgb, 0, 0, 0, 0\.14\);/);
  assert.ok(source.includes("updateDynamicFavicon(detail?.glowIntensity ?? 0.56);"));
  assert.ok(source.includes("updateDynamicFavicon();"));
  assert.match(source, /function updateDynamicFavicon\(glowIntensity = 0\.56\)/);
  assert.match(source, /const BRAND_LOGO_PRIMARY = ["']#8F81F7["'];/);
  assert.match(source, /const BRAND_LOGO_SECONDARY = ["']#6EE7D8["'];/);
  assert.doesNotMatch(source, /updateDynamicFavicon\(hexColor|BRAND_LOGO_PRIMARY = ["']#FF7A18|BRAND_LOGO_SECONDARY = ["']#FFB347/);
  assert.match(source, /root\.style\.setProperty\(["']--accent-rgb["'], `\$\{rgb\.r\} \$\{rgb\.g\} \$\{rgb\.b\}`\);/);
  assert.doesNotMatch(source, /console\.(?:debug|info|log|warn|error)/);
});
