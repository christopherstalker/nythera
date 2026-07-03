import "server-only";

import { env } from "@/lib/env";
import { createGatewayEmbedding, streamGatewayResponse } from "@/lib/llm-gateway";
import type { ProviderKeys } from "@/lib/user-keys";
import type { PromptMessage, StreamChunk } from "@/types";
import { logSafeError } from "@/lib/secret-redaction";

type StreamInput = {
  messages: PromptMessage[];
  model: string;
  temperature: number;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
  userId: string;
  chatId: string;
  providerKeys?: ProviderKeys;
  signal?: AbortSignal;
};

export async function* streamLlmResponse(input: StreamInput): AsyncGenerator<StreamChunk> {
  if (!env.LLM_PROXY_URL || !env.INTERNAL_API_TOKEN) {
    yield* streamGatewayResponse(input);
    return;
  }

  try {
    const { signal, ...payload } = input;
    const response = await fetch(`${env.LLM_PROXY_URL}/v1/chat/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.INTERNAL_API_TOKEN}`
      },
      // Provider keys are passed only in this request payload; no key is cached globally by the proxy layer.
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok || !response.body) {
      yield* streamGatewayResponse(input);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedDone = false;
    let receivedDelta = false;
    let proxyErrorBeforeStream: string | null = null;

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

        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(data) as StreamChunk;
        } catch {
          continue;
        }
        if (chunk.type === "delta") {
          receivedDelta = true;
        }
        if (chunk.type === "done") {
          receivedDone = true;
        }
        if (chunk.type === "error" && !receivedDelta) {
          proxyErrorBeforeStream = chunk.message;
          continue;
        }
        yield chunk;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const data = buffer
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (data) {
        try {
          const chunk = JSON.parse(data) as StreamChunk;
          if (chunk.type === "delta") {
            receivedDelta = true;
          }
          if (chunk.type === "done") {
            receivedDone = true;
          }
          if (chunk.type === "error" && !receivedDelta) {
            proxyErrorBeforeStream = chunk.message;
          } else {
            yield chunk;
          }
        } catch {
          // Ignore a trailing partial SSE frame from a failed upstream stream.
        }
      }
    }

    if (proxyErrorBeforeStream && !receivedDelta) {
      logSafeError("External LLM proxy failed before streaming, using Vercel gateway.", proxyErrorBeforeStream);
      yield* streamGatewayResponse(input);
      return;
    }

    if (!receivedDone) {
      yield { type: "done" };
    }
  } catch (error) {
    if (input.signal?.aborted) {
      return;
    }

    logSafeError("External LLM proxy failed, using Vercel gateway.", error);
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
      logSafeError("Embedding proxy failed, using deterministic fallback.", error);
    }
  }

  return createGatewayEmbedding(text, providerKeys);
}
