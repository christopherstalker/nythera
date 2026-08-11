import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("registration requires adult consent and validates Turnstile server-side", async () => {
  const [registration, apiRoute, verifier, schema] = await Promise.all([
    read("../src/app/(auth)/register/page.tsx"),
    read("../src/app/api/auth/register/route.ts"),
    read("../src/lib/turnstile.ts"),
    read("../src/lib/validation.ts")
  ]);

  assert.match(registration, /I confirm I am 18 or older/);
  assert.match(registration, /<TurnstileWidget action="register"/);
  assert.match(schema, /adultAcknowledged: z\.literal\(true/);
  assert.match(apiRoute, /verifyTurnstile/);
  assert.match(apiRoute, /adultTermsAcceptedAt: new Date\(\)/);
  assert.match(verifier, /turnstile\/v0\/siteverify/);
  assert.match(verifier, /verification\.action !== input\.action/);
  assert.match(verifier, /TURNSTILE_ALLOWED_HOSTNAMES/);
});

test("chat creation and generation are blocked until adult consent exists", async () => {
  const [createRoute, streamRoute, mobileRoute] = await Promise.all([
    read("../src/app/api/chats/route.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts")
  ]);

  for (const route of [createRoute, streamRoute, mobileRoute]) {
    assert.match(route, /requireAdultConsent\(user\)/);
  }
});
