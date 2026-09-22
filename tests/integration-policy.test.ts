import assert from "node:assert/strict";
import test from "node:test";
import {
  hashIntegrationSecret,
  integrationClientSchema,
  integrationKeySchema,
  integrationSecret,
  parseIntegrationScopes,
  validPkce,
  validRedirectUri
} from "../src/lib/integration-policy";

test("PKCE validates the RFC 7636 S256 vector and rejects altered or malformed verifiers", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  assert.equal(validPkce(verifier, challenge), true);
  assert.equal(validPkce(`${verifier}x`, challenge), false);
  assert.equal(validPkce("short", challenge), false);
  assert.equal(validPkce(verifier, "short"), false);
  assert.equal(validPkce("!".repeat(43), challenge), false);
});

test("redirect registration permits HTTPS and loopback clients without allowing credentials or fragments", () => {
  for (const uri of [
    "https://chatgpt.com/connector_platform/oauth_redirect",
    "http://127.0.0.1:4455/callback",
    "http://localhost:3001/callback",
    "http://[::1]:3001/callback"
  ]) {
    assert.equal(validRedirectUri(uri), true, uri);
  }
  for (const uri of [
    "https://example.com/#token",
    "https://user:password@example.com/callback",
    "http://example.com/callback",
    "javascript:alert(1)",
    "http://127.0.0.1.attacker.test/callback",
    "//example.com/callback"
  ]) {
    assert.equal(validRedirectUri(uri), false, uri);
  }
  assert.equal(
    integrationClientSchema.safeParse({
      redirect_uris: ["https://example.com/callback"],
      token_endpoint_auth_method: "client_secret_basic"
    }).success,
    false
  );
});

test("keys default to private creation permissions and reject escalation or unknown scopes", () => {
  const key = integrationKeySchema.parse({ name: "Writer" });
  assert.deepEqual(key.scopes, ["characters:read", "characters:write"]);
  assert.throws(() => integrationKeySchema.parse({ name: "Writer", userId: "another-user" }));
  assert.throws(() => parseIntegrationScopes("characters:read users:admin"));
  assert.throws(() => parseIntegrationScopes("characters:write"));
  assert.deepEqual(parseIntegrationScopes("characters:read characters:read"), ["characters:read"]);
});

test("connection secrets carry 256 bits of entropy and are represented by a one-way digest", () => {
  const first = integrationSecret();
  const second = integrationSecret();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.equal(hashIntegrationSecret(first).length, 64);
  assert.notEqual(hashIntegrationSecret(first), hashIntegrationSecret(second));
  assert.equal(hashIntegrationSecret(first), hashIntegrationSecret(first));
});
