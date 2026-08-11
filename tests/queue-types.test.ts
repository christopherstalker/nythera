import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Redis error callback is explicitly typed for strict TypeScript", async () => {
  const source = await readFile(new URL("../src/lib/queue.ts", import.meta.url), "utf8");

  assert.match(source, /function reportConnectionError\(error: Error\)/);
  assert.match(source, /connection\?\.on\("error", reportConnectionError\)/);
});
