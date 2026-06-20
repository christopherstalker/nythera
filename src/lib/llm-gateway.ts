import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { classifyProviderError } from "@/lib/llm-provider-errors";
import type { ProviderKey, ProviderKeys } from "@/lib/user-keys";
import type { PromptMessage, StreamChunk } from "@/types";

type StreamInput = {
  messages: PromptMessage[];
  model: string;
  temperature: number;
  userId: string;
  chatId: string;
  providerKeys?: ProviderKeys;
};

const APP_DEFAULT_MODELS = new Set(["gpt-4o-mini", "gpt-3.5-turbo"]);

type GatewayRoute = {
  provider: "openai" | "anthropic" | "gemini" | "openai-compatible";
  providerName: string;
  model: string;
  key?: ProviderKey;
};

export async function* streamGatewayResponse(input: StreamInput): AsyncGenerator<StreamChunk> {
  const keys = input.providerKeys ?? [];
  const route = routeModel(input.model, keys);
  const attempts = [route, ...fallbackRoutes(route, keys)];
  let lastError: unknown = null;
  const started = Date.now();
  const attemptLabels: string[] = [];

  for (const [index, attempt] of attempts.entries()) {
    let emittedAny = false;
    const attemptStarted = Date.now();
    attemptLabels.push(`${attempt.providerName}:${attempt.model}`);
    try {
      let outputText = "";
      const usage = await streamProvider({
        provider: attempt.provider,
        model: attempt.model,
        messages: input.messages,
        temperature: input.temperature,
        key: attempt.key,
        writeDelta(delta) {
          outputText += delta;
          return delta;
        }
      });

      for await (const delta of usage.deltas) {
        emittedAny = true;
        yield { type: "delta", text: delta };
      }

      console.info({
        event: "llm_provider_attempt",
        provider: attempt.providerName,
        userId: input.userId,
        chatId: input.chatId,
        success: true,
        statusCode: 200,
        latencyMs: Date.now() - attemptStarted
      });

      yield {
        type: "usage",
        inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
        outputTokens: estimateTokens(outputText),
        provider: attempt.providerName,
        model: attempt.model,
        latencyMs: Date.now() - started,
        fallbackTriggered: index > 0,
        attempts: attemptLabels
      };
      yield { type: "done" };
      return;
    } catch (error) {
      lastError = error;
      const classified = classifyProviderError(error);
      console.warn({
        event: "llm_provider_attempt",
        provider: attempt.providerName,
        userId: input.userId,
        chatId: input.chatId,
        success: false,
        statusCode: classified.status,
        errorCode: classified.code,
        latencyMs: Date.now() - attemptStarted
      });
      if (emittedAny) {
        yield { type: "error", message: "The model stream was interrupted." };
        return;
      }
      if (!classified.retryable) {
        yield { type: "error", message: classified.message };
        return;
      }
    }
  }

  const classified = classifyProviderError(lastError);
  yield { type: "error", message: classified.message };
}

export async function createGatewayEmbedding(text: string, providerKeys?: ProviderKeys) {
  const openaiKey = providerKeys?.find((key) => key.apiFormat === "OPENAI" || key.provider === "openai");
  if (openaiKey) {
    try {
      const openai = new OpenAI({
        apiKey: openaiKey.apiKey,
        baseURL: openaiKey.baseUrl || "https://api.openai.com/v1"
      });
      const result = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 1536
      });

      return result.data[0].embedding;
    } catch (error) {
      console.error("OpenAI embedding failed, using deterministic fallback.", error);
    }
  }

  return deterministicEmbedding(text);
}

function routeModel(requested: string, keys: ProviderKeys): GatewayRoute {
  const raw = requested.trim() || "gpt-4o-mini";
  const normalized = raw.toLowerCase();

  const explicit = parseExplicitProviderModel(raw, keys);
  if (explicit) {
    return explicit;
  }

  if (APP_DEFAULT_MODELS.has(normalized)) {
    const defaultKey = keys[0];
    if (defaultKey) {
      return routeFromKey(defaultKey, defaultKey.defaultModel || raw);
    }
  }

  const exactDefault = keys.find((key) => key.defaultModel?.toLowerCase() === normalized);
  if (exactDefault) {
    return routeFromKey(exactDefault, exactDefault.defaultModel || raw);
  }

  if (normalized.includes("claude")) {
    const key = keys.find((item) => item.apiFormat === "ANTHROPIC" || item.provider === "anthropic");
    return key ? routeFromKey(key, raw) : routeFromAvailableKey(keys) ?? { provider: "anthropic", providerName: "anthropic", model: raw };
  }

  if (normalized.includes("gemini")) {
    const key = keys.find((item) => item.apiFormat === "GEMINI" || item.provider === "gemini");
    return key ? routeFromKey(key, raw) : routeFromAvailableKey(keys) ?? { provider: "gemini", providerName: "gemini", model: raw };
  }

  if (normalized.includes("deepseek")) {
    const key = keys.find((item) => item.provider === "deepseek");
    return key
      ? routeFromKey(key, raw)
      : routeFromAvailableKey(keys) ?? { provider: "openai-compatible", providerName: "deepseek", model: raw };
  }

  if (normalized.includes("4o") || normalized.includes("gpt-4")) {
    const key = keys.find((item) => item.apiFormat === "OPENAI" || item.provider === "openai");
    return key ? routeFromKey(key, raw) : routeFromAvailableKey(keys) ?? { provider: "openai", providerName: "openai", model: raw };
  }

  const defaultKey = keys.find((key) => key.defaultModel) ?? keys[0];
  if (defaultKey) {
    return routeFromKey(defaultKey, defaultKey.defaultModel || raw);
  }

  return { provider: "openai", providerName: "openai", model: raw };
}

function routeFromAvailableKey(keys: ProviderKeys) {
  const key = keys.find((item) => item.defaultModel) ?? keys[0];
  return key ? routeFromKey(key, key.defaultModel || "gpt-4o-mini") : null;
}

function fallbackRoutes(primary: GatewayRoute, keys: ProviderKeys) {
  const routes = keys.map((key) => routeFromKey(key, key.defaultModel || "gpt-4o-mini"));
  return routes.filter((route) => route.providerName !== primary.providerName || route.model !== primary.model);
}

function parseExplicitProviderModel(requested: string, keys: ProviderKeys) {
  const separator = requested.indexOf(":");
  if (separator <= 0) {
    return null;
  }

  const provider = requested.slice(0, separator).trim().toLowerCase();
  const model = requested.slice(separator + 1).trim();
  const key = keys.find((item) => item.provider === provider);
  if (!key || !model) {
    return null;
  }

  return routeFromKey(key, model);
}

function routeFromKey(key: ProviderKey, model: string): GatewayRoute {
  if (key.apiFormat === "ANTHROPIC") {
    return { provider: "anthropic", providerName: key.provider, model, key };
  }

  if (key.apiFormat === "GEMINI") {
    return { provider: "gemini", providerName: key.provider, model, key };
  }

  if (key.apiFormat === "OPENAI") {
    return { provider: "openai", providerName: key.provider, model, key };
  }

  return { provider: "openai-compatible", providerName: key.provider, model, key };
}

async function streamProvider(input: {
  provider: "openai" | "anthropic" | "gemini" | "openai-compatible";
  model: string;
  messages: PromptMessage[];
  temperature: number;
  key?: ProviderKey;
  writeDelta: (delta: string) => string;
}) {
  if (input.provider === "openai" || input.provider === "openai-compatible") {
    if (!input.key?.apiKey) {
      throw new Error(`${input.provider} is not configured.`);
    }

    return {
      deltas: streamOpenAI({
        client: new OpenAI({
          apiKey: input.key.apiKey,
          baseURL:
            input.provider === "openai"
              ? input.key.baseUrl || "https://api.openai.com/v1"
              : requireBaseUrl(input.key)
        }),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        writeDelta: input.writeDelta
      })
    };
  }

  if (input.provider === "anthropic") {
    if (!input.key?.apiKey) {
      throw new Error("Anthropic is not configured.");
    }

    return {
      deltas: streamAnthropic({
        client: new Anthropic({ apiKey: input.key.apiKey }),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        writeDelta: input.writeDelta
      })
    };
  }

  if (input.provider === "gemini") {
    if (!input.key?.apiKey) {
      throw new Error("Gemini is not configured.");
    }

    return {
      deltas: streamGemini({
        client: new GoogleGenerativeAI(input.key.apiKey),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        writeDelta: input.writeDelta
      })
    };
  }

  throw new Error(`${input.provider} is not configured.`);
}

function requireBaseUrl(key: ProviderKey) {
  if (!key.baseUrl) {
    throw new Error(`Base URL is required for ${key.displayName}.`);
  }

  return key.baseUrl;
}

async function* streamOpenAI(input: {
  client: OpenAI;
  model: string;
  messages: PromptMessage[];
  temperature: number;
  writeDelta: (delta: string) => string;
}) {
  const stream = await input.client.chat.completions.create({
    model: input.model,
    messages: input.messages,
    temperature: input.temperature,
    stream: true
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield input.writeDelta(delta);
    }
  }
}

async function* streamAnthropic(input: {
  client: Anthropic;
  model: string;
  messages: PromptMessage[];
  temperature: number;
  writeDelta: (delta: string) => string;
}) {
  const system = input.messages.find((message) => message.role === "system")?.content;
  const messages = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: message.content
    }));

  const stream = input.client.messages.stream({
    model: input.model,
    max_tokens: 900,
    temperature: input.temperature,
    system,
    messages
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield input.writeDelta(event.delta.text);
    }
  }
}

async function* streamGemini(input: {
  client: GoogleGenerativeAI;
  model: string;
  messages: PromptMessage[];
  temperature: number;
  writeDelta: (delta: string) => string;
}) {
  const model = input.client.getGenerativeModel({
    model: input.model,
    generationConfig: { temperature: input.temperature }
  });
  const prompt = input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield input.writeDelta(text);
    }
  }
}

function deterministicEmbedding(text: string) {
  const vector = new Array(1536).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    const slot = index % vector.length;
    vector[slot] += (text.charCodeAt(index) % 31) / 31;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
