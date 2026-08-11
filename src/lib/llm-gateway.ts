import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { classifyProviderError } from "@/lib/llm-provider-errors";
import type { ProviderKey, ProviderKeys } from "@/lib/user-keys";
import type { PromptMessage, StreamChunk } from "@/types";
import { eligibleFallbackKeys } from "@/lib/provider-fallback";
import { logPerformanceMetric } from "@/lib/performance-logger";
import { logSafeError } from "@/lib/secret-redaction";
import {
  abortableAsyncIterable,
  createActivityTimeoutSignal,
  createTimeoutSignal,
  LLM_EMBEDDING_TIMEOUT_MS,
  LLM_FIRST_TOKEN_TIMEOUT_MS,
  LLM_PROVIDER_TIMEOUT_MS,
  LLM_STREAM_IDLE_TIMEOUT_MS
} from "@/lib/llm-timeouts";
import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-origin";

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
  const attempts = attemptRoutes(route, keys);
  const primaryKeyCount = keys.filter((key) => key.provider === route.providerName).length;
  let lastError: unknown = null;
  const started = Date.now();
  const attemptLabels: string[] = [];
  const gatewayDeadline = createTimeoutSignal(input.signal, LLM_PROVIDER_TIMEOUT_MS, "Provider request timed out.");

  try {
    for (const [index, attempt] of attempts.entries()) {
      if (gatewayDeadline.signal.aborted) {
        break;
      }

      let emittedAny = false;
      let firstTokenLogged = false;
      const attemptStarted = Date.now();
      const attemptSignal = createActivityTimeoutSignal(
        gatewayDeadline.signal,
        LLM_FIRST_TOKEN_TIMEOUT_MS,
        "Provider did not start responding in time."
      );
      attemptLabels.push(`${attempt.providerName}:${attempt.model}`);
      try {
        let outputText = "";
        const usage = await streamProvider({
          provider: attempt.provider,
          model: attempt.model,
          messages: input.messages,
          temperature: input.temperature,
          topP: input.topP,
          frequencyPenalty: input.frequencyPenalty,
          presencePenalty: input.presencePenalty,
          maxTokens: input.maxTokens,
          maxRetries: primaryKeyCount > 1 ? 0 : undefined,
          key: attempt.key,
          signal: attemptSignal.signal,
          writeDelta(delta) {
            outputText += delta;
            return delta;
          }
        });

        for await (const delta of abortableAsyncIterable(usage.deltas, attemptSignal.signal)) {
          emittedAny = true;
          attemptSignal.reset(LLM_STREAM_IDLE_TIMEOUT_MS, "Provider stream stalled.");
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            logPerformanceMetric("llm_time_to_first_token", {
              route: "chat:gateway",
              provider: attempt.providerName,
              model: attempt.model,
              attempt: index + 1,
              keySlot: (attempt.key?.providerPriority ?? 0) + 1,
              fallbackTriggered: index > 0,
              durationMs: Date.now() - started,
              providerLatencyMs: Date.now() - attemptStarted
            });
          }
          yield { type: "delta", text: delta };
        }

        const providerUsage = usage.getUsage();

        logPerformanceMetric("llm_provider_attempt", {
          route: "chat:gateway",
          provider: attempt.providerName,
          model: attempt.model,
          keySlot: (attempt.key?.providerPriority ?? 0) + 1,
          success: true,
          statusCode: 200,
          latencyMs: Date.now() - attemptStarted
        });

        yield {
          type: "usage",
          inputTokens: providerUsage?.inputTokens ?? estimateTokens(input.messages.map((message) => message.content).join("\n")),
          outputTokens: providerUsage?.outputTokens ?? estimateTokens(outputText),
          provider: attempt.providerName,
          model: attempt.model,
          usageEstimated: providerUsage === null,
          latencyMs: Date.now() - started,
          fallbackTriggered: index > 0,
          attempts: attemptLabels
        };
        yield { type: "done" };
        return;
      } catch (error) {
        if (input.signal?.aborted) {
          return;
        }

        lastError = attemptSignal.timedOut() || gatewayDeadline.timedOut() ? new Error("Provider request timed out.") : error;
        const classified = classifyProviderError(lastError);
        logPerformanceMetric("llm_provider_attempt", {
          route: "chat:gateway",
          provider: attempt.providerName,
          model: attempt.model,
          keySlot: (attempt.key?.providerPriority ?? 0) + 1,
          success: false,
          statusCode: classified.status,
          errorCode: classified.code,
          latencyMs: Date.now() - attemptStarted
        });
        if (emittedAny) {
          yield { type: "error", message: "The model stream was interrupted." };
          return;
        }
        const nextAttempt = attempts[index + 1];
        const hasNextKeyForProvider = nextAttempt?.providerName === attempt.providerName;
        if (!classified.retryable && !(hasNextKeyForProvider && isKeyScopedFailure(classified.code))) {
          yield {
            type: "error",
            message: exhaustedProviderMessage(route, primaryKeyCount, classified.message)
          };
          return;
        }
      } finally {
        attemptSignal.dispose();
      }
    }
  } finally {
    gatewayDeadline.dispose();
  }

  const classified = classifyProviderError(lastError);
  yield { type: "error", message: exhaustedProviderMessage(route, primaryKeyCount, classified.message) };
}

export async function createGatewayEmbedding(text: string, providerKeys?: ProviderKeys) {
  const openaiKey = providerKeys?.find((key) => key.apiFormat === "OPENAI" || key.provider === "openai");
  if (openaiKey) {
    const timeout = createTimeoutSignal(undefined, LLM_EMBEDDING_TIMEOUT_MS, "Embedding provider request timed out.");
    try {
      const baseURL = openaiKey.baseUrl
        ? await assertSafeOutboundUrl(openaiKey.baseUrl)
        : "https://api.openai.com/v1";
      const openai = new OpenAI({
        apiKey: openaiKey.apiKey,
        baseURL
      });
      const result = await openai.embeddings.create(
        {
          model: "text-embedding-3-small",
          input: text,
          dimensions: 1536
        },
        { signal: timeout.signal }
      );

      return result.data[0].embedding;
    } catch (error) {
      logSafeError("OpenAI embedding failed, using deterministic fallback.", error);
    } finally {
      timeout.dispose();
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
  const routes = eligibleFallbackKeys(primary.providerName, keys).map((key) => routeFromKey(key, key.defaultModel || "gpt-4o-mini"));
  return routes.filter((route) => route.providerName !== primary.providerName || route.model !== primary.model);
}

function attemptRoutes(primary: GatewayRoute, keys: ProviderKeys) {
  const sameProvider = keys
    .filter((key) => key.provider === primary.providerName && key.id !== primary.key?.id)
    .sort((left, right) =>
      (left.providerPriority ?? Number.MAX_SAFE_INTEGER) - (right.providerPriority ?? Number.MAX_SAFE_INTEGER)
    )
    .map((key) => routeFromKey(key, primary.model));
  return [primary, ...sameProvider, ...fallbackRoutes(primary, keys)];
}

function isKeyScopedFailure(code: ReturnType<typeof classifyProviderError>["code"]) {
  return code === "invalid_api_key" ||
    code === "insufficient_balance" ||
    code === "rate_limit" ||
    code === "provider_unavailable" ||
    code === "network_error" ||
    code === "provider_error";
}

function exhaustedProviderMessage(route: GatewayRoute, keyCount: number, fallbackMessage: string) {
  if (keyCount <= 1) {
    return fallbackMessage;
  }

  const provider = route.key?.displayName || route.providerName;
  return `All ${keyCount} saved keys for ${provider} failed for this request. Check or replace them in Settings.`;
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
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
  maxRetries?: number;
  key?: ProviderKey;
  signal: AbortSignal;
  writeDelta: (delta: string) => string;
}) {
  if (input.provider === "openai" || input.provider === "openai-compatible") {
    if (!input.key?.apiKey) {
      throw new Error(`${input.provider} is not configured.`);
    }

    const baseURL = input.key.baseUrl
      ? await assertSafeOutboundUrl(input.key.baseUrl)
      : input.provider === "openai"
        ? "https://api.openai.com/v1"
        : requireBaseUrl(input.key);
    const usage = createUsageTracker();
    return {
      deltas: streamOpenAI({
        client: new OpenAI({
          apiKey: input.key.apiKey,
          baseURL,
          maxRetries: input.maxRetries,
          defaultHeaders:
            input.key.provider === "openrouter"
              ? {
                  "HTTP-Referer": CANONICAL_SITE_ORIGIN,
                  "X-OpenRouter-Title": "Nythera"
                }
              : undefined
        }),
        model: input.model,
        providerName: input.key.provider,
        messages: input.messages,
        temperature: input.temperature,
        topP: input.topP,
        frequencyPenalty: input.frequencyPenalty,
        presencePenalty: input.presencePenalty,
        maxTokens: input.maxTokens,
        signal: input.signal,
        writeDelta: input.writeDelta,
        onUsage: usage.record
      }),
      getUsage: usage.read
    };
  }

  if (input.provider === "anthropic") {
    if (!input.key?.apiKey) {
      throw new Error("Anthropic is not configured.");
    }

    const usage = createUsageTracker();
    return {
      deltas: streamAnthropic({
        client: new Anthropic({ apiKey: input.key.apiKey, maxRetries: input.maxRetries }),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        topP: input.topP,
        maxTokens: input.maxTokens,
        signal: input.signal,
        writeDelta: input.writeDelta,
        onUsage: usage.record
      }),
      getUsage: usage.read
    };
  }

  if (input.provider === "gemini") {
    if (!input.key?.apiKey) {
      throw new Error("Gemini is not configured.");
    }

    const usage = createUsageTracker();
    return {
      deltas: streamGemini({
        client: new GoogleGenerativeAI(input.key.apiKey),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        topP: input.topP,
        maxTokens: input.maxTokens,
        signal: input.signal,
        writeDelta: input.writeDelta,
        onUsage: usage.record
      }),
      getUsage: usage.read
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
  providerName: string;
  messages: PromptMessage[];
  temperature: number;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
  writeDelta: (delta: string) => string;
  onUsage: (usage: { inputTokens: number; outputTokens: number }) => void;
}) {
  const stream = await input.client.chat.completions.create(
    {
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      top_p: input.topP ?? undefined,
      frequency_penalty: input.providerName === "deepseek" ? undefined : input.frequencyPenalty ?? undefined,
      presence_penalty: input.providerName === "deepseek" ? undefined : input.presencePenalty ?? undefined,
      max_tokens: input.maxTokens ?? undefined,
      stream: true,
      stream_options: { include_usage: true }
    },
    { signal: input.signal }
  );

  for await (const chunk of stream) {
    if (chunk.usage) {
      input.onUsage({
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens
      });
    }
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
  topP?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
  writeDelta: (delta: string) => string;
  onUsage: (usage: { inputTokens: number; outputTokens: number }) => void;
}) {
  let inputTokens = 0;
  let outputTokens = 0;
  const system = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const messages = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: message.content
    }));

  const stream = input.client.messages.stream(
    {
      model: input.model,
      max_tokens: input.maxTokens ?? 900,
      temperature: input.temperature,
      top_p: input.topP ?? undefined,
      system,
      messages
    },
    { signal: input.signal }
  );

  for await (const event of stream) {
    if (event.type === "message_start") {
      inputTokens = event.message.usage.input_tokens;
      input.onUsage({ inputTokens, outputTokens });
    }
    if (event.type === "message_delta") {
      outputTokens = event.usage.output_tokens;
      input.onUsage({ inputTokens, outputTokens });
    }
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
  topP?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
  writeDelta: (delta: string) => string;
  onUsage: (usage: { inputTokens: number; outputTokens: number }) => void;
}) {
  const model = input.client.getGenerativeModel({
    model: input.model,
    systemInstruction: input.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
    generationConfig: {
      temperature: input.temperature,
      topP: input.topP ?? undefined,
      maxOutputTokens: input.maxTokens ?? undefined
    }
  });
  const contents = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));
  const result = await model.generateContentStream({ contents }, {
    signal: input.signal,
    timeout: LLM_PROVIDER_TIMEOUT_MS
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield input.writeDelta(text);
    }
  }
  const response = await result.response;
  if (response.usageMetadata) {
    input.onUsage({
      inputTokens: response.usageMetadata.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata.candidatesTokenCount ?? 0
    });
  }
}

function createUsageTracker() {
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  return {
    record(next: { inputTokens: number; outputTokens: number }) {
      usage = next;
    },
    read() {
      return usage;
    }
  };
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
