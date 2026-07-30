import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("PWA auth transactions are short-lived, random, hashed, and single-use", async () => {
  const [source, providerIds] = await Promise.all([
    read("../src/lib/pwa-auth-transactions.ts"),
    read("../src/lib/oauth-provider-ids.ts")
  ]);

  assert.match(source, /TRANSACTION_TTL_SECONDS = 5 \* 60/);
  assert.match(source, /randomBytes\(24\)\.toString\("base64url"\)/);
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /\{ ex: TRANSACTION_TTL_SECONDS, nx: true \}/);
  assert.match(source, /redis\.call\("DEL", KEYS\[1\]\)/);
  assert.match(source, /record\.nonceHash ~= ARGV\[1\]/);
  assert.match(source, /NODE_ENV === "production" && !redis/);
  assert.match(source, /z\.enum\(OAUTH_PROVIDER_IDS\)/);
  assert.match(providerIds, /"apple"/);
});

test("the internal handoff provider consumes a transaction and still enforces account bans", async () => {
  const auth = await read("../src/lib/auth.ts");

  assert.match(auth, /id: "pwa-handoff"/);
  assert.match(auth, /consumePwaAuthTransaction\(transactionId, nonce\)/);
  assert.match(auth, /if \(!user \|\| user\.bannedAt\)/);
  assert.doesNotMatch(auth, /skipCSRFCheck|csrf:\s*false/i);
});

test("standalone OAuth uses an external provider window and returns the session to its own context", async () => {
  const [buttons, complete, client] = await Promise.all([
    read("../src/components/auth/oauth-buttons.tsx"),
    read("../src/components/auth/pwa-oauth-complete.tsx"),
    read("../src/lib/auth-client.ts")
  ]);

  assert.match(buttons, /if \(!standalone\)/);
  assert.match(buttons, /window\.open\([\s\S]*?\/auth\/pwa\/preparing/);
  assert.match(buttons, /\/api\/auth\/pwa\/transactions/);
  assert.match(buttons, /\/status/);
  assert.match(buttons, /signIn\("pwa-handoff"/);
  assert.match(buttons, /hasAuthenticatedSession\(\)/);
  assert.match(buttons, /if \(!providerWindowOpened\)[\s\S]*window\.location\.assign\(body\.startUrl\)/);
  assert.match(complete, /readStoredPwaAuthTransaction\(\)/);
  assert.match(complete, /stored\?\.transactionId === transactionId/);
  assert.match(complete, /clearStoredPwaAuthTransaction\(\)/);
  assert.match(complete, /window\.location\.assign\(stored\.callbackPath\)/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.doesNotMatch(client, /localStorage/);
});

test("handoff URLs never expose the device nonce and completion requires an authenticated user", async () => {
  const [createRoute, completeRoute, startRoute] = await Promise.all([
    read("../src/app/api/auth/pwa/transactions/route.ts"),
    read("../src/app/api/auth/pwa/transactions/[transactionId]/complete/route.ts"),
    read("../src/app/(auth)/auth/pwa/start/route.ts")
  ]);

  const startUrl = createRoute.slice(createRoute.indexOf("startUrl:"));
  assert.match(startUrl, /transactionId/);
  assert.doesNotMatch(startUrl, /nonce/);
  assert.match(completeRoute, /requireUser\(\)/);
  assert.match(completeRoute, /provider:\s*transaction\.provider/);
  assert.match(completeRoute, /if \(!providerAccount\)/);
  assert.match(startRoute, /getPwaAuthTransactionForStart/);
});

test("PWA registration redirects to the provider before rendering an auth page", async () => {
  const [startRoute, preparingPage, completePage] = await Promise.all([
    read("../src/app/(auth)/auth/pwa/start/route.ts"),
    read("../src/app/(auth)/auth/pwa/preparing/page.tsx"),
    read("../src/app/(auth)/auth/pwa/complete/page.tsx")
  ]);

  assert.match(startRoute, /signIn\(transaction\.provider/);
  assert.match(startRoute, /redirect:\s*false/);
  assert.match(startRoute, /redirectTo:\s*completionUrl/);
  assert.match(startRoute, /NextResponse\.redirect\(providerUrl,\s*303\)/);
  assert.doesNotMatch(startRoute, /AuthExperience|PwaOAuthStart|next-auth\/react/);
  assert.doesNotMatch(preparingPage, /AuthExperience|WhisperPanel/);
  assert.doesNotMatch(completePage, /AuthExperience|WhisperPanel/);
});

test("first-time OAuth users return to the PWA completion route", async () => {
  const [auth, newUserPage] = await Promise.all([
    read("../src/lib/auth.ts"),
    read("../src/app/(auth)/auth/new-user/page.tsx")
  ]);

  assert.match(auth, /newUser:\s*"\/auth\/new-user"/);
  assert.match(newUserPage, /startsWith\("\/auth\/pwa\/complete\?transactionId="\)/);
  assert.match(newUserPage, /redirect\("\/settings"\)/);
});

test("legacy installs receive an explicit canonical migration surface", async () => {
  const [config, migrationPage, shell] = await Promise.all([
    read("../next.config.mjs"),
    read("../src/app/(auth)/pwa-migrate/page.tsx"),
    read("../src/components/layout/AppShell.tsx")
  ]);

  assert.match(config, /pwa-migrate\?source=legacy-pwa/);
  assert.match(config, /permanent: false/);
  assert.match(migrationPage, /Browsers isolate[\s\S]*?sessions by origin/);
  assert.match(migrationPage, /www\.nythera\.art/);
  assert.match(shell, /pathname\.startsWith\("\/pwa-migrate"\)/);
  assert.match(shell, /h-dvh touch-pan-y overflow-y-auto overscroll-y-contain/);
});
