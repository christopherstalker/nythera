import "server-only";

import { env } from "@/lib/env";
import { createGatewayEmbedding, streamGatewayResponse } from "@/lib/llm-gateway";
import type { ProviderKeys } from "@/lib/user-keys";
import type { PromptMessage, StreamChunk } from "@/types";
import { logSafeError } from "@/lib/secret-redaction";
import { readProxyStream } from "@/lib/proxy-stream";
import { signShieldRequest } from "../../proxy-service/src/request-auth";
import {
  createActivityTimeoutSignal, createTimeoutSignal, LLM_EMBEDDING_TIMEOUT_MS,
  LLM_FIRST_TOKEN_TIMEOUT_MS, LLM_PROVIDER_TIMEOUT_MS, LLM_STREAM_IDLE_TIMEOUT_MS
} from "@/lib/llm-timeouts";

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
  const usesPersonalKeys = input.providerKeys?.some((key) => key.source === "user") ?? false;
  if (!env.LLM_PROXY_URL || !(env.AI_SHIELD_SIGNING_SECRET || env.INTERNAL_API_TOKEN) || usesPersonalKeys || input.messages.some((message) => message.images?.length)) {
    yield* streamGatewayResponse(input);
    return;
  }

  let receivedDelta = false;
  const proxyDeadline = createTimeoutSignal(input.signal, LLM_PROVIDER_TIMEOUT_MS, "LLM proxy request timed out.");
  const proxySignal = createActivityTimeoutSignal(proxyDeadline.signal, LLM_FIRST_TOKEN_TIMEOUT_MS, "LLM proxy did not start responding in time.");
  try {
    const { signal: _signal, ...payload } = input;
    const body = JSON.stringify(payload);
    const path = "/v1/chat/stream";
    const response = await fetch(`${env.LLM_PROXY_URL}${path}`, {
      method: "POST", headers: proxyHeaders(path, body), body, signal: proxySignal.signal
    });
    if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
      await response.body?.cancel();
      throw new Error("AI Shield is unavailable.");
    }
    for await (const chunk of readProxyStream(response.body, () => proxySignal.reset(LLM_STREAM_IDLE_TIMEOUT_MS, "LLM proxy stream stalled."))) {
      if (chunk.type === "delta") receivedDelta = true;
      yield chunk;
    }
    return;
  } catch (error) {
    if (input.signal?.aborted) return;
    if (receivedDelta) {
      yield { type: "error", message: "The model stream was interrupted." };
      return;
    }
    logSafeError("External LLM proxy failed before streaming, using Vercel gateway.", error);
  } finally {
    proxySignal.dispose();
    proxyDeadline.dispose();
  }

  // Never restart a provider after any response text has reached the client.
  yield* streamGatewayResponse(input);
}

export async function createEmbedding(text: string, providerKeys?: ProviderKeys) {
  const usesPersonalKeys = providerKeys?.some((key) => key.source === "user") ?? false;
  if (env.LLM_PROXY_URL && (env.AI_SHIELD_SIGNING_SECRET || env.INTERNAL_API_TOKEN) && !usesPersonalKeys) {
    const proxySignal = createTimeoutSignal(undefined, LLM_EMBEDDING_TIMEOUT_MS, "Embedding proxy request timed out.");
    try {
      const path = "/v1/embeddings";
      const body = JSON.stringify({ text, providerKeys });
      const response = await fetch(`${env.LLM_PROXY_URL}${path}`, {
        method: "POST", headers: proxyHeaders(path, body), body, signal: proxySignal.signal
      });
      if (response.ok) {
        const payload = await response.json() as { embedding?: unknown };
        if (Array.isArray(payload.embedding) && payload.embedding.length === 1536 && payload.embedding.every((value) => typeof value === "number" && Number.isFinite(value))) {
          return payload.embedding as number[];
        }
      }
    } catch (error) {
      logSafeError("Embedding proxy failed, using the application gateway.", error);
    } finally {
      proxySignal.dispose();
    }
  }
  return createGatewayEmbedding(text, providerKeys);
}

function proxyHeaders(path: string, body: string) {
  return {
    "content-type": "application/json",
    ...(env.AI_SHIELD_SIGNING_SECRET
      ? signShieldRequest(env.AI_SHIELD_SIGNING_SECRET, path, body)
      : { authorization: `Bearer ${env.INTERNAL_API_TOKEN}` })
  };
}

export async function checkShieldTransport(): Promise<"disabled" | "healthy" | "unavailable"> {
  if (!env.LLM_PROXY_URL || !env.AI_SHIELD_SIGNING_SECRET) return "disabled";
  const path = "/v1/health";
  const body = "{}";
  try {
    const response = await fetch(`${env.LLM_PROXY_URL}${path}`, {
      method: "POST", headers: proxyHeaders(path, body), body, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return "unavailable";
    const health = await response.json() as { ok?: boolean; service?: string };
    return health.ok === true && health.service === "nythera-ai-shield" ? "healthy" : "unavailable";
  } catch {
    return "unavailable";
  }
}
