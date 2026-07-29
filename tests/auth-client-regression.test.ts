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
  assert.match(source, /hasAuthenticatedSession\(\)/);
  assert.match(source, /disabled=\{submitting\}/);
  assert.match(source, /window\.location\.assign/);
});

test("registration verifies the new session before leaving the auth surface", async () => {
  const source = await readFile(new URL("../src/app/(auth)/register/page.tsx", import.meta.url), "utf8");

  assert.match(source, /signIn\("credentials"/);
  assert.match(source, /redirect: false/);
  assert.match(source, /hasAuthenticatedSession\(\)/);
  assert.match(source, /disabled=\{submitting\}/);
});
