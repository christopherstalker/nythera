import assert from "node:assert/strict";
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
