import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("credentials login handles malformed or rejected auth responses without crashing", async () => {
  const source = await readFile(new URL("../src/app/(auth)/login/page.tsx", import.meta.url), "utf8");

  assert.match(source, /try\s*\{[\s\S]*signIn\("credentials"/);
  assert.match(source, /callbackUrl,/);
  assert.match(source, /catch\s*\{[\s\S]*setError\("Invalid email or password\."\)/);
});
