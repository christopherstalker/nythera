import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.env.AUTH_URL;
assert.ok(origin && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use a local test server.");
assert.ok(
  process.env.DATABASE_URL && ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname),
  "Use an isolated local database."
);
assert.ok(process.env.TEST_EMAIL && process.env.TEST_PASSWORD, "Set credentials for the isolated test account.");
const prisma = new PrismaClient();
const cookies = new Map();
const clients = [];
const hash = (secret) => createHash("sha256").update(secret).digest("hex");
let checks = 0;
function verified(label) {
  checks++;
  console.log(`PASS ${label}`);
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, origin), {
    ...options,
    redirect: "manual",
    headers: { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "), ...options.headers }
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0];
    const equals = pair.indexOf("=");
    cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
  return response;
}

async function issueKey(name, scopes) {
  const response = await request("/api/integrations", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ name, scopes })
  });
  assert.equal(response.status, 201);
  return response.json();
}

async function connect(token) {
  const client = new Client({ name: "nythera-integration-test", version: "1.0.0" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/api/mcp", origin), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } }
    })
  );
  return client;
}

async function oauthToken(parameters) {
  return request("/api/integrations/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ resource: `${origin}/api/mcp`, ...parameters })
  });
}

try {
  const anonymous = await request("/api/mcp");
  assert.equal(anonymous.status, 401);
  assert.ok(anonymous.headers.get("www-authenticate")?.includes("oauth-protected-resource/api/mcp"));
  verified("anonymous requests discover OAuth instead of accessing characters");

  const metadata = await (await request("/.well-known/oauth-authorization-server")).json();
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  const resource = await (await request("/.well-known/oauth-protected-resource/api/mcp")).json();
  assert.equal(resource.resource, `${origin}/api/mcp`);
  verified("OAuth discovery uses the same issuer and resource as the MCP endpoint");

  const csrf = await (await request("/api/auth/csrf")).json();
  const signedIn = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: process.env.TEST_EMAIL,
      password: process.env.TEST_PASSWORD,
      callbackUrl: `${origin}/settings/connections`
    })
  });
  assert.equal(signedIn.status, 200);
  const session = await (await request("/api/auth/session")).json();
  assert.ok(session.user?.id, "Credentials must produce a real session.");
  verified("connection management authenticates with the existing Nythera login");

  const crossSite = await request("/api/integrations", {
    method: "POST",
    headers: { Origin: "https://attacker.test", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Blocked" })
  });
  assert.equal(crossSite.status, 403);
  verified("cross-origin connection creation is rejected");

  const issued = await issueKey("MCP verification");
  const stored = await prisma.integrationGrant.findUniqueOrThrow({ where: { id: issued.connection.id } });
  assert.equal(stored.tokenHash, hash(issued.token));
  const listing = await (await request("/api/integrations")).json();
  assert.equal(JSON.stringify(listing).includes(issued.token), false);
  assert.equal(JSON.stringify(listing).includes(stored.tokenHash), false);
  verified("keys are hashed at rest and omitted from connection listings");

  const client = await connect(issued.token);
  const inventory = await client.listTools();
  assert.equal(inventory.tools.length, 5);
  for (const tool of inventory.tools) {
    assert.ok(tool._meta.securitySchemes[0].scopes.includes("characters:read"));
  }
  assert.equal(
    inventory.tools.find((tool) => tool.name === "create_character").inputSchema.properties.visibility,
    undefined
  );
  verified("the official MCP client initializes and discovers all five tools");

  const created = await client.callTool({
    name: "create_character",
    arguments: {
      name: "Mira Vale",
      description: "A patient archivist who preserves the city's forgotten stories.",
      personality: "Observant, thoughtful and quietly curious; she remembers details and asks precise questions.",
      greeting: "The archive is still open. Which story brought you here?",
      scenario: "A rain-soaked city archive after closing time.",
      persona: { background: "Mira has spent ten years restoring abandoned journals." },
      tags: ["mystery"]
    }
  });
  assert.equal(created.isError, undefined);
  const characterId = created.structuredContent.character.id;
  assert.equal(created.structuredContent.character.visibility, "PRIVATE");
  assert.equal((await prisma.character.findUniqueOrThrow({ where: { id: characterId } })).creatorId, session.user.id);
  verified("MCP creation persists a private character under the connected account");

  const updated = await client.callTool({
    name: "update_character",
    arguments: { characterId, changes: { greeting: "I found the journal you asked for." } }
  });
  assert.equal(updated.isError, undefined);
  const readBack = await client.callTool({ name: "get_character", arguments: { characterId } });
  assert.equal(readBack.structuredContent.character.greeting, "I found the journal you asked for.");
  const roster = await client.callTool({ name: "list_characters", arguments: { query: "Mira" } });
  assert.ok(roster.structuredContent.characters.some((character) => character.id === characterId));
  verified("editing, reading and searching return the saved character");

  const other = await prisma.user.create({ data: { email: `other-${randomBytes(8).toString("hex")}@example.test` } });
  const foreign = await prisma.character.create({
    data: {
      creatorId: other.id,
      name: "Private stranger",
      description: "Belongs to another account.",
      personality: "Never shared with the connected user.",
      greeting: "Private."
    }
  });
  assert.equal(
    (await client.callTool({ name: "get_character", arguments: { characterId: foreign.id } })).isError,
    true
  );
  assert.equal(
    (
      await client.callTool({
        name: "update_character",
        arguments: { characterId: foreign.id, changes: { greeting: "Changed" } }
      })
    ).isError,
    true
  );
  assert.equal((await prisma.character.findUniqueOrThrow({ where: { id: foreign.id } })).greeting, "Private.");
  verified("even an administrator's integration cannot read or edit another account's private character");

  assert.equal(
    (await client.callTool({ name: "update_character", arguments: { characterId, changes: { visibility: "PUBLIC" } } }))
      .isError,
    true
  );
  const blockedPublication = await client.callTool({
    name: "set_character_visibility",
    arguments: { characterId, visibility: "UNLISTED" }
  });
  assert.equal(blockedPublication.isError, true);
  assert.ok(blockedPublication._meta["mcp/www_authenticate"]);
  assert.ok(blockedPublication._meta["mcp/www_authenticate"][0].includes('scope="characters:read characters:publish"'));
  verified("visibility cannot be smuggled into edits and requires a separate permission");

  const reader = await issueKey("Read-only verifier", ["characters:read"]);
  const readClient = await connect(reader.token);
  assert.equal(
    (
      await readClient.callTool({
        name: "update_character",
        arguments: { characterId, changes: { greeting: "No write access" } }
      })
    ).isError,
    true
  );
  verified("read-only connections cannot change character content");

  const publisher = await issueKey("Publication verifier", ["characters:read", "characters:publish"]);
  const publicationClient = await connect(publisher.token);
  const shared = await publicationClient.callTool({
    name: "set_character_visibility",
    arguments: { characterId, visibility: "UNLISTED" }
  });
  assert.equal(shared.isError, undefined);
  assert.equal(shared.structuredContent.character.visibility, "UNLISTED");
  verified("explicit publication permission enables visibility changes");

  const revoke = await request("/api/integrations", {
    method: "DELETE",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ id: issued.connection.id })
  });
  assert.equal(revoke.status, 204);
  const afterRevoke = await request("/api/mcp", { headers: { Authorization: `Bearer ${issued.token}` } });
  assert.equal(afterRevoke.status, 401);
  verified("revocation stops an existing key on its next request");

  const registered = await request("/api/integrations/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "OAuth verification", redirect_uris: [`${origin}/settings/connections`] })
  });
  assert.equal(registered.status, 201);
  const application = await registered.json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorization = new URLSearchParams({
    client_id: application.client_id,
    response_type: "code",
    redirect_uri: `${origin}/settings/connections`,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: `${origin}/api/mcp`,
    scope: "characters:read characters:write",
    state: randomBytes(16).toString("hex")
  });
  const consent = await request(`/oauth/authorize?${authorization}`);
  assert.equal(consent.status, 200);
  const html = await consent.text();
  assert.ok(html.includes("Allow connection") && html.includes("OAuth verification"));
  const consentForm = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find((match) =>
    match[1].includes("Allow connection")
  );
  assert.ok(consentForm, "Consent must include the real server action form.");
  const decode = (value) =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  function formDecision(decision) {
    const form = new FormData();
    for (const match of consentForm[1].matchAll(/<input\b[^>]*>/g)) {
      const field = /\bname="([^"]*)"/.exec(match[0]);
      const value = /\bvalue="([^"]*)"/.exec(match[0]);
      if (field) form.append(decode(field[1]), decode(value?.[1] ?? ""));
    }
    form.append("decision", decision);
    return form;
  }
  const denial = await request(`/oauth/authorize?${authorization}`, {
    method: "POST",
    headers: { Origin: origin },
    body: formDecision("deny")
  });
  assert.equal(denial.status, 303);
  assert.equal(new URL(denial.headers.get("location")).searchParams.get("error"), "access_denied");
  const approval = await request(`/oauth/authorize?${authorization}`, {
    method: "POST",
    headers: { Origin: origin },
    body: formDecision("allow")
  });
  assert.equal(approval.status, 303);
  const callback = new URL(approval.headers.get("location"));
  assert.equal(callback.searchParams.get("state"), authorization.get("state"));
  assert.equal(callback.searchParams.get("iss"), origin);
  const code = callback.searchParams.get("code");
  assert.ok(code);
  verified("OAuth consent accepts and denies through the real authenticated server action");

  const tokenFields = {
    grant_type: "authorization_code",
    client_id: application.client_id,
    redirect_uri: `${origin}/settings/connections`,
    code,
    code_verifier: verifier
  };
  assert.equal(
    (await oauthToken({ ...tokenFields, code_verifier: randomBytes(32).toString("base64url") })).status,
    400
  );
  assert.equal((await oauthToken({ ...tokenFields, resource: "https://attacker.test/api/mcp" })).status, 400);
  assert.equal((await oauthToken({ ...tokenFields, redirect_uri: "https://attacker.test/callback" })).status, 400);
  verified("OAuth rejects a wrong verifier, audience and redirect URI");

  const exchanged = await oauthToken(tokenFields);
  assert.equal(exchanged.status, 200);
  const tokens = await exchanged.json();
  assert.equal((await oauthToken(tokenFields)).status, 400);
  const oauthClient = await connect(tokens.access_token);
  assert.equal((await oauthClient.listTools()).tools.length, 5);
  verified("authorization codes are single-use and the resulting OAuth token works with MCP");

  const refreshed = await oauthToken({
    grant_type: "refresh_token",
    client_id: application.client_id,
    refresh_token: tokens.refresh_token
  });
  assert.equal(refreshed.status, 200);
  const rotated = await refreshed.json();
  assert.equal(
    (
      await oauthToken({
        grant_type: "refresh_token",
        client_id: application.client_id,
        refresh_token: tokens.refresh_token
      })
    ).status,
    400
  );
  assert.equal(
    (await request("/api/mcp", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).status,
    401
  );
  verified("refresh tokens rotate atomically and old credentials stop working");

  const oauthRevocation = await request("/api/integrations/oauth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: application.client_id, token: rotated.refresh_token })
  });
  assert.equal(oauthRevocation.status, 200);
  assert.equal(
    (await request("/api/mcp", { headers: { Authorization: `Bearer ${rotated.access_token}` } })).status,
    401
  );
  assert.equal(
    (
      await oauthToken({
        grant_type: "refresh_token",
        client_id: application.client_id,
        refresh_token: rotated.refresh_token
      })
    ).status,
    400
  );
  verified("OAuth revocation disables both access and refresh credentials");

  await prisma.integrationGrant.update({ where: { id: reader.connection.id }, data: { expiresAt: new Date(0) } });
  assert.equal((await request("/api/mcp", { headers: { Authorization: `Bearer ${reader.token}` } })).status, 401);
  verified("expired connection keys cannot access MCP");

  await prisma.user.update({ where: { id: session.user.id }, data: { bannedAt: new Date() } });
  assert.equal((await request("/api/mcp", { headers: { Authorization: `Bearer ${publisher.token}` } })).status, 401);
  await prisma.user.update({ where: { id: session.user.id }, data: { bannedAt: null } });
  verified("account bans take effect on existing connections");

  await prisma.user.update({ where: { id: session.user.id }, data: { authVersion: { increment: 1 } } });
  assert.equal((await request("/api/mcp", { headers: { Authorization: `Bearer ${publisher.token}` } })).status, 401);
  verified("account session invalidation also invalidates integration credentials");
  console.log(`Verified ${checks} integration boundaries against local PostgreSQL.`);
} finally {
  await Promise.allSettled(clients.map((client) => client.close()));
  await prisma.$disconnect();
}
