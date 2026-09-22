import { getRequestIp, parseJson, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { integrationClientSchema } from "@/lib/integration-policy";
import { integrationOAuthError } from "@/lib/integration-oauth";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({ ip: getRequestIp(request), route: "integrations:register" });
    const registration = await parseJson(request, integrationClientSchema, { maxBytes: 16 * 1024 });
    const client = await prisma.integrationClient.create({
      data: { name: registration.client_name, redirectUris: registration.redirect_uris }
    });
    return Response.json(
      { ...registration, client_id: client.id, client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return integrationOAuthError(error) ?? routeError(error);
  }
}
