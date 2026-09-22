import { getRequestIp, HttpError, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hashIntegrationSecret } from "@/lib/integration-policy";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({ ip: getRequestIp(request), route: "integrations:token" });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 4096) throw new HttpError(413, "Request body is too large.");
    const parameters = new URLSearchParams(body);
    const token = parameters.get("token");
    const clientId = parameters.get("client_id");
    if (!token || !clientId) throw new HttpError(400, "A token and client_id are required.");
    const hash = hashIntegrationSecret(token);
    await prisma.integrationGrant.updateMany({
      where: { clientId, OR: [{ tokenHash: hash }, { refreshHash: hash }], revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
