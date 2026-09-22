import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getRequestIp, HttpError, parseJson, routeError } from "@/lib/api";
import { createCharacterMcpServer } from "@/lib/character-mcp";
import { integrationChallenge, requireIntegration } from "@/lib/integration-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serveMcp(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== resolveSiteOrigin()) throw new HttpError(403, "Origin is not allowed.");
    await enforceRateLimit({ ip: getRequestIp(request), route: "integrations:mcp" });
    const grant = await requireIntegration(request);
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
    }
    const parsedBody = await parseJson(request, z.unknown(), { maxBytes: 1024 * 1024 });
    const server = createCharacterMcpServer(grant);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody });
      response.headers.set("Cache-Control", "no-store");
      return response;
    } finally {
      await server.close();
    }
  } catch (error) {
    const response = routeError(error);
    response.headers.set("Cache-Control", "no-store");
    if (error instanceof HttpError && error.status === 401)
      response.headers.set("WWW-Authenticate", integrationChallenge());
    return response;
  }
}

export const POST = serveMcp;
export const GET = serveMcp;
export const DELETE = serveMcp;
