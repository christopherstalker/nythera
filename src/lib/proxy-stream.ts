import { z } from "zod";
import type { StreamChunk } from "@/types";

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string().max(100_000) }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({
    type: z.literal("usage"), inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative(),
    model: z.string(), provider: z.string(), usageEstimated: z.boolean(),
    latencyMs: z.number().nonnegative().optional(), fallbackTriggered: z.boolean().optional(), attempts: z.array(z.string()).optional()
  })
]);

export async function* readProxyStream(body: ReadableStream<Uint8Array>, onActivity: () => void): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasText = false;
  try {
    while (true) {
      const packet = await reader.read();
      buffer += packet.done ? decoder.decode() : decoder.decode(packet.value, { stream: true });
      if (buffer.length > 256_000) throw new Error("Proxy event exceeded the transport limit.");
      const frames = buffer.replace(/\r\n/g, "\n").split("\n\n");
      buffer = frames.pop() ?? "";
      if (packet.done && buffer.trim()) frames.push(buffer);
      for (const frame of frames) {
        const json = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!json) continue;
        const event = eventSchema.parse(JSON.parse(json));
        if (event.type === "error") throw new Error("AI Shield could not complete the provider request.");
        if (event.type === "delta") {
          if (!hasText && !event.text.trim()) continue;
          hasText = true;
          onActivity();
        }
        if (event.type === "done") {
          if (!hasText) throw new Error("AI Shield returned an empty response.");
          yield event;
          return;
        }
        yield event;
      }
      if (packet.done) throw new Error("AI Shield stream ended without completion.");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
