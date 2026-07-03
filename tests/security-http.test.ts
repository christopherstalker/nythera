import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("global HTTP security headers are configured", async () => {
  const config = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");

  for (const header of [
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "Permissions-Policy"
  ]) {
    assert.match(config, new RegExp(header));
  }

  for (const directive of [
    "frame-ancestors 'none'",
    "object-src 'none'",
    "default-src 'self'",
    "connect-src 'self'",
    "https://api.openai.com",
    "https://api.anthropic.com",
    "https://generativelanguage.googleapis.com",
    "https://api.deepseek.com",
    "https://api.mistral.ai",
    "https://api.groq.com",
    "https://api.x.ai",
    "https://openrouter.ai"
  ]) {
    assert.match(config, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(config, /isProduction[\s\S]*Strict-Transport-Security/);
  assert.match(config, /isProduction \? "upgrade-insecure-requests" : ""/);
});

test("NextAuth session expiry is finite and CSRF defaults are not disabled", async () => {
  const auth = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");

  assert.match(auth, /maxAge:\s*30 \* 24 \* 60 \* 60/);
  assert.doesNotMatch(auth, /csrf:\s*false|skipCSRFCheck|sameSite:\s*["']none["']/i);
});
