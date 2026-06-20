import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("manual install guidance is limited to iOS Safari", async () => {
  const pwa = await readFile(new URL("../src/lib/pwa.ts", import.meta.url), "utf8");
  const provider = await readFile(new URL("../src/components/providers/pwa-provider.tsx", import.meta.url), "utf8");

  assert.match(pwa, /export function isIosSafari/);
  assert.match(pwa, /CriOS\|FxiOS\|EdgiOS\|OPiOS/);
  assert.match(provider, /setIos\(isIosSafari\(\)\)/);
});
