import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { safeLocalRedirect } from "../src/lib/safe-local-redirect";
import { isAuthExperiencePath } from "../src/lib/auth-routes";

test("local auth redirects reject protocol-relative and backslash destinations", () => {
  assert.equal(
    safeLocalRedirect("/settings?tab=security"),
    "/settings?tab=security",
  );
  assert.equal(safeLocalRedirect("//example.com"), "/explore");
  assert.equal(safeLocalRedirect("/\\example.com"), "/explore");
  assert.equal(safeLocalRedirect("https://example.com"), "/explore");
});

test("password recovery pages use the same chrome-free auth experience", () => {
  assert.equal(isAuthExperiencePath("/login"), true);
  assert.equal(isAuthExperiencePath("/register/password"), true);
  assert.equal(isAuthExperiencePath("/forgot-password"), true);
  assert.equal(isAuthExperiencePath("/reset-password"), true);
  assert.equal(isAuthExperiencePath("/explore"), false);
});

test("the service worker never caches authenticated navigation HTML", async () => {
  const serviceWorker = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  const navigationBranch =
    serviceWorker.match(
      /if \(request\.mode === "navigate"\) \{[\s\S]*?\n  \}/,
    )?.[0] ?? "";

  assert.match(serviceWorker, /nythera-codex-v6/);
  assert.doesNotMatch(navigationBranch, /cache\.put|caches\.match\(request\)/);
  assert.match(navigationBranch, /caches\.match\("\/offline\.html"\)/);
});

test("PWA updates wait for the new worker before reloading the app", async () => {
  const provider = await readFile(
    new URL("../src/components/providers/pwa-provider.tsx", import.meta.url),
    "utf8",
  );

  assert.match(provider, /addEventListener\("controllerchange", onControllerChange\)/);
  assert.match(
    provider,
    /waiting\?\.postMessage\(\{ type: "SKIP_WAITING" \}\)/,
  );
});

test("provider keys are no longer unique per user and provider", async () => {
  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260823165000_multikey_auth_recovery/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const keyStore = await readFile(
    new URL("../src/lib/user-keys.ts", import.meta.url),
    "utf8",
  );
  const apiKeyModel =
    schema.match(/model UserApiKey \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.doesNotMatch(apiKeyModel, /@@unique\(\[userId, provider\]\)/);
  assert.match(apiKeyModel, /@@index\(\[userId, provider, providerPriority\]\)/);
  assert.match(
    migration,
    /DROP INDEX IF EXISTS "UserApiKey_userId_provider_key"/,
  );
  assert.match(keyStore, /decryptSecret\(row\.encryptedKey\)/);
  assert.match(keyStore, /unreadableKeyIds/);
});

test("password setup and recovery invalidate older authenticated sessions", async () => {
  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  const accountRoute = await readFile(
    new URL("../src/app/api/account/password/route.ts", import.meta.url),
    "utf8",
  );
  const forgotRoute = await readFile(
    new URL("../src/app/api/auth/forgot-password/route.ts", import.meta.url),
    "utf8",
  );
  const resetRoute = await readFile(
    new URL("../src/app/api/auth/reset-password/route.ts", import.meta.url),
    "utf8",
  );
  const auth = await readFile(
    new URL("../src/lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(schema, /model PasswordResetToken/);
  assert.match(schema, /authVersion\s+Int\s+@default\(0\)/);
  assert.match(accountRoute, /authVersion:\s*\{ increment: 1 \}/);
  assert.match(resetRoute, /consumePasswordReset/);
  assert.match(forgotRoute, /return json\(\{ ok: true \}\)/);
  assert.match(forgotRoute, /logSafeError\("Password reset delivery failed\."/);
  assert.match(auth, /token\.authVersion !== dbUser\.authVersion/);
});

test("roleplay prompt keeps appearance details out of the model-facing persona", async () => {
  const prompt = await readFile(
    new URL("../src/lib/prompt-assembly.ts", import.meta.url),
    "utf8",
  );
  const persona = await readFile(
    new URL("../src/lib/user-persona-prompt.ts", import.meta.url),
    "utf8",
  );
  const vector = await readFile(
    new URL("../src/lib/vector.ts", import.meta.url),
    "utf8",
  );

  assert.match(prompt, /Never infer slower walking, reduced speed/);
  assert.match(prompt, /PLAYER PERSONA — AUTHORITATIVE IDENTITY AND BOUNDARIES/);
  assert.match(prompt, /Treat appearance and traits as background continuity/);
  assert.match(persona, /Canonical player identity:/);
  assert.doesNotMatch(persona, /`Traits:/);
  assert.match(vector, />= 0\.35/);
});
