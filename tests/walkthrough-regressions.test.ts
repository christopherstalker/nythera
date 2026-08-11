import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("new accounts enter verified BYOK onboarding", async () => {
  const [register, newUser, providers, keyRoute] = await Promise.all([
    read("../src/app/(auth)/register/page.tsx"),
    read("../src/app/(auth)/auth/new-user/page.tsx"),
    read("../src/components/settings/key-settings-client.tsx"),
    read("../src/app/api/keys/route.ts")
  ]);

  assert.match(register, /\/auth\/new-user\?callbackUrl=\/explore/);
  assert.match(register, /password\.length >= 8/);
  assert.match(register, /\^\[a-zA-Z0-9_\]\{3,24\}\$/);
  assert.match(newUser, /\/settings\/providers\?onboarding=1/);
  assert.match(providers, /First connection/);
  assert.match(providers, /Verify and save/);
  assert.match(keyRoute, /validateProviderCredentials/);
  assert.ok(keyRoute.indexOf("validateProviderCredentials") < keyRoute.indexOf("saveUserApiKey({"));
});

test("chat preserves rejected drafts and exposes interruption state", async () => {
  const [input, client, hook, limits, validation] = await Promise.all([
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/hooks/useChat.ts"),
    read("../src/lib/chat-limits.ts"),
    read("../src/lib/validation.ts")
  ]);

  assert.match(limits, /MAX_CHAT_MESSAGE_LENGTH = 4000/);
  assert.match(input, /maxLength=\{MAX_CHAT_MESSAGE_LENGTH\}/);
  assert.match(input, /MAX_CHAT_MESSAGE_LENGTH\.toLocaleString/);
  assert.match(client, /if \(!accepted\)/);
  assert.match(client, /setDraft\(\(current\) => current \|\| content\)/);
  assert.match(hook, /The previous response was interrupted/);
  assert.match(validation, /max\(MAX_CHAT_MESSAGE_LENGTH/);
});

test("private character owners receive server-rendered profiles without public indexing", async () => {
  const [profileStore, page] = await Promise.all([
    read("../src/lib/public-character-profile.ts"),
    read("../src/app/(main)/character/[id]/page.tsx")
  ]);

  assert.match(profileStore, /getCharacterProfileForViewer/);
  assert.match(profileStore, /\.\.\.\(viewerId \? \[\{ creatorId: viewerId \}\] : \[\]\)/);
  assert.match(page, /auth\(\)/);
  assert.match(page, /character\.visibility === "PUBLIC"/);
  assert.match(page, /index: false/);
});

test("local production can use memory rate limiting while hosted deployments fail closed", async () => {
  const rateLimit = await read("../src/lib/rate-limit.ts");

  assert.match(rateLimit, /RATE_LIMIT_REQUIRE_DISTRIBUTED/);
  assert.match(rateLimit, /process\.env\.VERCEL \|\| process\.env\.RAILWAY_ENVIRONMENT \|\| process\.env\.RENDER/);
  assert.match(rateLimit, /requiresDistributedRateLimit\(\) && !hasDistributedRateLimitStore\(\)/);
});

test("background queue failures stop retrying and cannot flood production logs", async () => {
  const queue = await read("../src/lib/queue.ts");

  assert.match(queue, /maxRetriesPerRequest: 1/);
  assert.match(queue, /attempt <= 1 \? 250 : null/);
  assert.match(queue, /connectionErrorReported/);
  assert.match(queue, /backgroundQueue\?\.on\("error", reportConnectionError\)/);
});

test("local production registration bypasses missing Turnstile without weakening public deployments", async () => {
  const turnstile = await read("../src/lib/turnstile.ts");

  assert.match(turnstile, /process\.env\.NODE_ENV !== "production" \|\| isLocalApplicationOrigin\(\)/);
  assert.match(turnstile, /hostname === "localhost" \|\| hostname === "127\.0\.0\.1" \|\| hostname === "\[::1\]"/);
  assert.match(turnstile, /throw new HttpError\(503, "Human verification is not configured\."\)/);
});

test("legacy invalid provider keys are quarantined before chat routing", async () => {
  const [schema, keys, modelsRoute, chat] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../src/lib/user-keys.ts"),
    read("../src/app/api/keys/models/route.ts"),
    read("../src/components/chat/chat-client.tsx")
  ]);

  assert.match(schema, /credentialStatus String\s+@default\("UNVERIFIED"\)/);
  assert.match(keys, /credentialStatus: "VALID"/);
  assert.match(modelsRoute, /credentialStatusFromDiscovery/);
  assert.match(modelsRoute, /fallbackEnabled: false/);
  assert.match(chat, /key\.credentialStatus === "VALID"/);
  assert.match(chat, /verifiedKeysResponse/);
});

test("explore and public profiles use the established glass customization system", async () => {
  const [profileSettings, profileRoute, accountHub, publicProfile, explore, globals] = await Promise.all([
    read("../src/lib/profile-settings.ts"),
    read("../src/app/api/profile/route.ts"),
    read("../src/components/account/account-hub-client.tsx"),
    read("../src/components/profile/public-profile-view.tsx"),
    read("../src/components/explore/explore-page-client.tsx"),
    read("../src/app/globals.css")
  ]);

  assert.match(profileSettings, /"ember" \| "veil"/);
  assert.match(profileSettings, /surfaceStyle: "glass"/);
  assert.match(profileSettings, /avatarShape: "circle"/);
  assert.match(profileSettings, /bannerHeight: "cinematic"/);
  assert.match(profileRoute, /z\.enum\(\["glass", "luminous", "editorial"\]\)/);
  assert.match(accountHub, /Surface treatment/);
  assert.match(accountHub, /Avatar shape/);
  assert.match(accountHub, /Banner scale/);
  assert.match(publicProfile, /data-surface=\{settings\.surfaceStyle \?\? "glass"\}/);
  assert.match(explore, /neo-glass-panel relative isolate grid/);
  assert.match(globals, /\.nythera-profile\[data-surface="luminous"\]/);
  assert.match(globals, /\.codex-character-gallery/);
});
