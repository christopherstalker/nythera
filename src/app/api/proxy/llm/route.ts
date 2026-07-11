import { env } from "@/lib/env";
import { streamGatewayResponse } from "@/lib/llm-gateway";
import { getRequestIp, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getServerProviderKeys, type ProviderKeys } from "@/lib/user-keys";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!env.INTERNAL_API_TOKEN || token !== env.INTERNAL_API_TOKEN) {
      return Response.json({ error: "Internal token required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid proxy request." }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    await enforceRateLimit({
      userId: typeof record.userId === "string" ? record.userId : undefined,
      ip: getRequestIp(request),
      route: "proxy:llm"
    });

    const providerKeys = withServerProviderKeys(Array.isArray(record.providerKeys) ? record.providerKeys as ProviderKeys : []);
    const input = { ...record, providerKeys, signal: request.signal } as Parameters<typeof streamGatewayResponse>[0];
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamGatewayResponse(input)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

function withServerProviderKeys(keys: ProviderKeys) {
  const providers = new Set(keys.map((key) => key.provider));
  return [...keys, ...getServerProviderKeys().filter((key) => !providers.has(key.provider))];
}
