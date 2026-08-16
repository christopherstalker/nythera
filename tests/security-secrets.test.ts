import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("BYOK encryption uses a dedicated master secret and authenticated encryption", async () => {
  const cryptoSource = await readFile(new URL("../src/lib/crypto.ts", import.meta.url), "utf8");
  const envSource = await readFile(new URL("../src/lib/env.ts", import.meta.url), "utf8");

  assert.match(envSource, /API_KEY_ENCRYPTION_SECRET/);
  assert.match(cryptoSource, /aes-256-gcm/);
  assert.match(cryptoSource, /randomBytes\(IV_LENGTH\)/);
  assert.match(cryptoSource, /getDecryptionSecrets/);
  assert.doesNotMatch(cryptoSource, /INTERNAL_API_TOKEN/);
});

test("unreadable legacy BYOK entries do not break platform provider fallback", async () => {
  const keyStore = await readFile(new URL("../src/lib/user-keys.ts", import.meta.url), "utf8");

  assert.match(keyStore, /catch\s*\{\s*unreadableKeyIds\.push\(row\.id\)/);
  assert.match(keyStore, /credentialStatus:\s*"INVALID"/);
  assert.match(keyStore, /return keys;/);
  assert.match(keyStore, /getServerProviderKeys\(\)\.filter/);
});

test("security log redaction covers provider keys and bearer tokens", async () => {
  const redactionSource = await readFile(new URL("../src/lib/secret-redaction.ts", import.meta.url), "utf8");

  assert.match(redactionSource, /Bearer\\s\+/);
  assert.match(redactionSource, /sk-\[A-Za-z0-9_-/);
  assert.match(redactionSource, /SENSITIVE_NAME_PATTERN/);
  assert.match(redactionSource, /authorization\|proxy-authorization/);
  assert.match(redactionSource, /api\[-_\]\?key/);
  assert.match(redactionSource, /logSafeError/);
});

test("saved provider key APIs expose only public key metadata", async () => {
  const userKeys = await readFile(new URL("../src/lib/user-keys.ts", import.meta.url), "utf8");
  const voiceKeys = await readFile(new URL("../src/lib/voice-keys.ts", import.meta.url), "utf8");
  const keyRoute = await readFile(new URL("../src/app/api/keys/route.ts", import.meta.url), "utf8");
  const voiceRoute = await readFile(new URL("../src/app/api/voice/keys/route.ts", import.meta.url), "utf8");

  assert.match(userKeys, /last4:\s*true/);
  assert.match(voiceKeys, /last4:\s*true/);
  assert.doesNotMatch(keyRoute, /encryptedKey/);
  assert.doesNotMatch(voiceRoute, /encryptedKey/);
  assert.doesNotMatch(keyRoute, /apiKey:\s*key\.apiKey/);
  assert.doesNotMatch(voiceRoute, /apiKey:\s*key\.apiKey/);
});
