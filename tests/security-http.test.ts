import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("HTTP policy uses a per-request script nonce with strict dynamic loading", async () => {
  const { contentSecurityPolicy } = await import("../src/lib/content-security-policy");
  const productionPolicy = contentSecurityPolicy("test-nonce", true);
  const scriptPolicy = productionPolicy.split("; ").find((directive) => directive.startsWith("script-src"));
  assert.ok(scriptPolicy?.includes("'nonce-test-nonce'"));
  assert.ok(scriptPolicy?.includes("'strict-dynamic'"));
  assert.doesNotMatch(scriptPolicy!, /unsafe-inline|unsafe-eval/);
  assert.ok(productionPolicy.includes("upgrade-insecure-requests"));
  assert.ok(productionPolicy.includes("frame-ancestors 'none'"));
  assert.ok(contentSecurityPolicy("another-nonce", false).includes("'unsafe-eval'"));
  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /crypto.randomUUID/);
  assert.match(middleware, /requestHeaders.set\("Content-Security-Policy", policy\)/);
  assert.match(middleware, /response.headers.set\("Content-Security-Policy", policy\)/);
});

test("NextAuth session expiry is finite and CSRF defaults are not disabled", async () => {
  const auth = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");

  assert.match(auth, /maxAge:\s*30 \* 24 \* 60 \* 60/);
  assert.doesNotMatch(auth, /csrf:\s*false|skipCSRFCheck|sameSite:\s*["']none["']/i);
});
