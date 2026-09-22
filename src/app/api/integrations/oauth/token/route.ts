import { getRequestIp, HttpError, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { exchangeIntegrationToken, integrationOAuthError } from "@/lib/integration-oauth";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({ ip: getRequestIp(request), route: "integrations:token" });
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      throw new HttpError(415, "Use a form-encoded OAuth request.");
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 16 * 1024) throw new HttpError(413, "Request body is too large.");
    const tokens = await exchangeIntegrationToken(Object.fromEntries(new URLSearchParams(body)));
    return Response.json(tokens, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (error) {
    return integrationOAuthError(error) ?? routeError(error);
  }
}
