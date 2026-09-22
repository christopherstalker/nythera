import "server-only";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { resolveSiteOrigin } from "@/lib/site-origin";
import { hashIntegrationSecret } from "@/lib/integration-policy";

export const integrationUserSelect = {
  id: true,
  role: true,
  ageVerified: true,
  birthDate: true,
  unlimitedCharacterFields: true,
  authVersion: true,
  bannedAt: true
} as const;

export function integrationResource() {
  return `${resolveSiteOrigin()}/api/mcp`;
}

export function integrationChallenge(scope?: string) {
  const requiredScopes = scope && scope !== "characters:read" ? `characters:read ${scope}` : scope;
  return `Bearer resource_metadata="${resolveSiteOrigin()}/.well-known/oauth-protected-resource/api/mcp"${requiredScopes ? `, error="insufficient_scope", scope="${requiredScopes}"` : ""}`;
}

export async function requireIntegration(request: Request) {
  const bearer = /^Bearer (nythera_[A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") ?? "");
  if (!bearer) throw new HttpError(401, "Connect your Nythera account to continue.");
  const grant = await prisma.integrationGrant.findUnique({
    where: { tokenHash: hashIntegrationSecret(bearer[1]) },
    include: { user: { select: integrationUserSelect } }
  });
  if (
    !grant ||
    grant.revokedAt ||
    grant.expiresAt <= new Date() ||
    grant.resource !== integrationResource() ||
    grant.user.bannedAt ||
    grant.authVersion !== grant.user.authVersion
  ) {
    throw new HttpError(401, "This connection has expired or was revoked. Connect again.");
  }
  // An integration never inherits the platform administrator's cross-account access.
  return { ...grant, user: { ...grant.user, role: "USER" } };
}

export type CharacterIntegration = Awaited<ReturnType<typeof requireIntegration>>;

export function requireIntegrationScope(grant: Pick<CharacterIntegration, "scopes">, scope: string) {
  if (!grant.scopes.includes(scope)) throw new HttpError(403, `This connection needs ${scope} access.`);
}

export function requireIntegrationOrigin(request: Request) {
  if (request.headers.get("origin") !== resolveSiteOrigin()) {
    throw new HttpError(403, "Open connection settings on Nythera to make this change.");
  }
}
