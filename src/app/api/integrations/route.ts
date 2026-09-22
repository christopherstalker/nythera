import { z } from "zod";
import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { integrationResource, requireIntegrationOrigin } from "@/lib/integration-auth";
import { hashIntegrationSecret, integrationKeySchema, integrationSecret } from "@/lib/integration-policy";

const connectionSelect = {
  id: true,
  name: true,
  scopes: true,
  clientId: true,
  createdAt: true,
  expiresAt: true,
  refreshExpiresAt: true,
  revokedAt: true
} as const;
const privateHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const user = await requireUser();
    const connections = await prisma.integrationGrant.findMany({
      where: { userId: user.id, authVersion: user.authVersion, revokedAt: null },
      select: connectionSelect,
      orderBy: { createdAt: "desc" }
    });
    return json({ connections, endpoint: integrationResource() }, { headers: privateHeaders });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireIntegrationOrigin(request);
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "integrations:keys" });
    const input = await parseJson(request, integrationKeySchema);
    const token = `nythera_${integrationSecret()}`;
    const connection = await prisma.integrationGrant.create({
      data: {
        ...input,
        userId: user.id,
        resource: integrationResource(),
        authVersion: user.authVersion,
        tokenHash: hashIntegrationSecret(token),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      },
      select: connectionSelect
    });
    return json({ connection, token }, { status: 201, headers: privateHeaders });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireIntegrationOrigin(request);
    const user = await requireUser();
    const { id } = await parseJson(request, z.object({ id: z.string().min(1).max(128) }).strict());
    await prisma.integrationGrant.updateMany({
      where: { id, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    return routeError(error);
  }
}
