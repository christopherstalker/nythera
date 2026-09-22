import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { integrationResource, integrationUserSelect } from "@/lib/integration-auth";
import {
  hashIntegrationSecret,
  integrationAuthorizationSchema,
  integrationSecret,
  parseIntegrationScopes,
  validPkce
} from "@/lib/integration-policy";
import { resolveSiteOrigin } from "@/lib/site-origin";

const ACCESS_TTL = 60 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;

export class IntegrationOAuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export async function validateIntegrationAuthorization(parameters: unknown) {
  const authorization = integrationAuthorizationSchema.parse(parameters);
  const client = await prisma.integrationClient.findUnique({ where: { id: authorization.client_id } });
  if (!client || !client.redirectUris.includes(authorization.redirect_uri)) {
    throw new IntegrationOAuthError("invalid_request", "This application or its return address is not registered.");
  }
  if (authorization.resource !== integrationResource()) {
    throw new IntegrationOAuthError("invalid_target", "The requested resource is not Nythera's character integration.");
  }
  const scopes = parseIntegrationScopes(authorization.scope);
  return { authorization, client, scopes };
}

export async function authorizeIntegration(parameters: unknown, userId: string, allowed: boolean) {
  const { authorization, client, scopes } = await validateIntegrationAuthorization(parameters);
  const destination = new URL(authorization.redirect_uri);
  destination.searchParams.set("iss", resolveSiteOrigin());
  if (authorization.state !== undefined) destination.searchParams.set("state", authorization.state);
  if (!allowed) {
    destination.searchParams.set("error", "access_denied");
    return destination.toString();
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: integrationUserSelect });
  if (user.bannedAt) throw new IntegrationOAuthError("access_denied", "This account cannot connect applications.");
  const code = integrationSecret();
  await prisma.integrationCode.create({
    data: {
      codeHash: hashIntegrationSecret(code),
      userId,
      clientId: client.id,
      redirectUri: authorization.redirect_uri,
      challenge: authorization.code_challenge,
      scopes,
      resource: authorization.resource,
      authVersion: user.authVersion,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }
  });
  destination.searchParams.set("code", code);
  return destination.toString();
}

const tokenRequestSchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token"]),
  client_id: z.string().min(1).max(128),
  resource: z.string().url(),
  code: z.string().max(128).optional(),
  code_verifier: z.string().max(128).optional(),
  redirect_uri: z.string().max(2048).optional(),
  refresh_token: z.string().max(128).optional(),
  scope: z.string().max(200).optional()
});

export async function exchangeIntegrationToken(parameters: unknown) {
  const request = tokenRequestSchema.parse(parameters);
  if (request.resource !== integrationResource()) {
    throw new IntegrationOAuthError("invalid_target", "Invalid resource.");
  }
  const token = `nythera_${integrationSecret()}`;
  const refreshToken = integrationSecret();
  const tokenFields = {
    tokenHash: hashIntegrationSecret(token),
    refreshHash: hashIntegrationSecret(refreshToken),
    expiresAt: new Date(Date.now() + ACCESS_TTL * 1000)
  };
  const scopes = await prisma.$transaction(async (transaction) => {
    if (request.grant_type === "authorization_code") {
      if (!request.code || !request.code_verifier || !request.redirect_uri) {
        throw new IntegrationOAuthError(
          "invalid_request",
          "The authorization code, verifier and redirect URI are required."
        );
      }
      const code = await transaction.integrationCode.findUnique({
        where: { codeHash: hashIntegrationSecret(request.code) },
        include: { client: true, user: { select: integrationUserSelect } }
      });
      if (
        !code ||
        code.expiresAt <= new Date() ||
        code.clientId !== request.client_id ||
        code.redirectUri !== request.redirect_uri ||
        code.resource !== request.resource ||
        code.user.bannedAt ||
        code.authVersion !== code.user.authVersion ||
        !validPkce(request.code_verifier, code.challenge)
      ) {
        throw new IntegrationOAuthError("invalid_grant", "The authorization code is invalid or expired.");
      }
      const consumed = await transaction.integrationCode.deleteMany({ where: { id: code.id } });
      if (consumed.count !== 1)
        throw new IntegrationOAuthError("invalid_grant", "The authorization code was already used.");
      await transaction.integrationGrant.create({
        data: {
          ...tokenFields,
          userId: code.userId,
          clientId: code.clientId,
          name: code.client.name,
          authVersion: code.authVersion,
          scopes: code.scopes,
          resource: code.resource,
          refreshExpiresAt: new Date(Date.now() + REFRESH_TTL * 1000)
        }
      });
      return code.scopes;
    }
    if (!request.refresh_token) throw new IntegrationOAuthError("invalid_request", "A refresh token is required.");
    const refreshHash = hashIntegrationSecret(request.refresh_token);
    const grant = await transaction.integrationGrant.findUnique({
      where: { refreshHash },
      include: { user: { select: integrationUserSelect } }
    });
    if (
      !grant ||
      grant.revokedAt ||
      !grant.refreshExpiresAt ||
      grant.refreshExpiresAt <= new Date() ||
      grant.clientId !== request.client_id ||
      grant.resource !== request.resource ||
      grant.user.bannedAt ||
      grant.authVersion !== grant.user.authVersion
    ) {
      throw new IntegrationOAuthError("invalid_grant", "This connection has expired or was revoked.");
    }
    const refreshedScopes = request.scope === undefined ? grant.scopes : parseIntegrationScopes(request.scope);
    if (refreshedScopes.some((scope) => !grant.scopes.includes(scope))) {
      throw new IntegrationOAuthError("invalid_scope", "Reconnect to request additional permissions.");
    }
    const rotated = await transaction.integrationGrant.updateMany({
      where: { id: grant.id, refreshHash, revokedAt: null },
      data: { ...tokenFields, scopes: refreshedScopes }
    });
    if (rotated.count !== 1) throw new IntegrationOAuthError("invalid_grant", "The refresh token was already used.");
    return refreshedScopes;
  });
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: refreshToken,
    scope: scopes.join(" ")
  };
}

export function integrationOAuthError(error: unknown) {
  if (error instanceof IntegrationOAuthError) {
    return Response.json(
      { error: error.code, error_description: error.message },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: "invalid_request", error_description: "Check the required OAuth parameters." },
      { status: 400 }
    );
  }
  return null;
}
