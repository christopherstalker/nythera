import "server-only";

import { env } from "@/lib/env";
import { createGatewayEmbedding, streamGatewayResponse } from "@/lib/llm-gateway";
import type { ProviderKeys } from "@/lib/user-keys";
import type { PromptMessage, StreamChunk } from "@/types";

type StreamInput = {
  messages: PromptMessage[];
  model: string;
  temperature: number;
  userId: string;
  chatId: string;
  providerKeys?: ProviderKeys;
};

export async function* streamLlmResponse(input: StreamInput): AsyncGenerator<StreamChunk> {
  if (!env.LLM_PROXY_URL || !env.INTERNAL_API_TOKEN) {
    yield* streamGatewayResponse(input);
    return;
  }

  try {
    const response = await fetch(`${env.LLM_PROXY_URL}/v1/chat/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.INTERNAL_API_TOKEN}`
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000)
    });

    if (!response.ok || !response.body) {
      yield* streamGatewayResponse(input);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const data = event
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice(6);

        if (!data) {
          continue;
        }

        const chunk = JSON.parse(data) as StreamChunk;
        yield chunk;
      }
    }

    yield { type: "done" };
  } catch (error) {
    console.error("External LLM proxy failed, using Vercel gateway.", error);
    yield* streamGatewayResponse(input);
  }
}

export async function createEmbedding(text: string, providerKeys?: ProviderKeys) {
  if (env.LLM_PROXY_URL && env.INTERNAL_API_TOKEN) {
    try {
      const response = await fetch(`${env.LLM_PROXY_URL}/v1/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.INTERNAL_API_TOKEN}`
        },
        body: JSON.stringify({ text, providerKeys }),
        signal: AbortSignal.timeout(15_000)
      });

      if (response.ok) {
        const body = (await response.json()) as { embedding: number[] };
        if (Array.isArray(body.embedding) && body.embedding.length === 1536) {
          return body.embedding;
        }
      }
    } catch (error) {
      console.error("Embedding proxy failed, using deterministic fallback.", error);
    }
  }

  return createGatewayEmbedding(text, providerKeys);
}
