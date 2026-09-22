import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const INTEGRATION_SCOPES = ["characters:read", "characters:write", "characters:publish"] as const;
export const DEFAULT_INTEGRATION_SCOPES: Array<(typeof INTEGRATION_SCOPES)[number]> = [
  "characters:read",
  "characters:write"
];
export const INTEGRATION_SCOPE_LABELS: Record<string, string> = {
  "characters:read": "Read your character cards",
  "characters:write": "Create private characters and edit your characters",
  "characters:publish": "Publish your characters or change their visibility"
};

export const integrationScopesSchema = z
  .array(z.enum(INTEGRATION_SCOPES))
  .min(1)
  .max(3)
  .refine((scopes) => scopes.includes("characters:read"), "Character read access is required.")
  .transform((scopes) => [...new Set(scopes)]);

export const integrationKeySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: integrationScopesSchema.default(DEFAULT_INTEGRATION_SCOPES)
  })
  .strict();

export function integrationSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashIntegrationSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function validPkce(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const expected = createHash("sha256").update(verifier).digest("base64url");
  return expected.length === challenge.length && timingSafeEqual(Buffer.from(expected), Buffer.from(challenge));
}

export function validRedirectUri(uri: string) {
  try {
    const url = new URL(uri);
    if (url.hash || url.username || url.password) return false;
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

export const integrationClientSchema = z.object({
  client_name: z.string().trim().min(1).max(80).default("AI client"),
  redirect_uris: z
    .array(z.string().max(2048).refine(validRedirectUri, "Use HTTPS or a loopback redirect URI."))
    .min(1)
    .max(10),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"])
});

export const integrationAuthorizationSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(128),
  redirect_uri: z.string().max(2048),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  scope: z.string().max(200).default(DEFAULT_INTEGRATION_SCOPES.join(" ")),
  state: z.string().max(2048).optional(),
  resource: z.string().url().max(2048)
});

export function parseIntegrationScopes(scope: string) {
  return integrationScopesSchema.parse(scope.trim().split(/\s+/));
}
