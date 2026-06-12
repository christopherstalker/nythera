import { env } from "@/lib/env";
import { streamGatewayResponse } from "@/lib/llm-gateway";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.INTERNAL_API_TOKEN || token !== env.INTERNAL_API_TOKEN) {
    return Response.json({ error: "Internal token required." }, { status: 401 });
  }

  const body = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamGatewayResponse(body)) {
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
      "cache-control": "no-cache, no-transform"
    }
  });
}
