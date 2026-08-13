import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("background memory work does not spend a second model request on every chat turn", async () => {
  const memory = await readFile(new URL("../src/lib/memory.ts", import.meta.url), "utf8");

  assert.match(memory, /turnNumber % 3 === 0/);
  assert.match(memory, /turnNumber % 6 === 0/);
  assert.match(memory, /shouldRunDeepExtraction && input\.providerKeys\?\.length/);
});
