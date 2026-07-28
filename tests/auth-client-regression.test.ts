import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("credentials login separates service failures from rejected credentials", async () => {
  const source = await readFile(new URL("../src/app/(auth)/login/page.tsx", import.meta.url), "utf8");

  assert.match(source, /try\s*\{[\s\S]*signIn\("credentials"/);
  assert.match(source, /callbackUrl,/);
  assert.match(source, /catch\s*\{[\s\S]*setError\("Sign-in service is temporarily unavailable\. Please try again\."\)/);
  assert.match(source, /if \(!result\)/);
  assert.match(source, /if \(result\.error\)[\s\S]*setError\("Invalid email or password\."\)/);
});
