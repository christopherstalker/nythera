import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { classifyProviderError } from "@/lib/llm-provider-errors";
import type { ProviderKey, ProviderKeys } from "@/lib/user-keys";
import type { PromptMessage, StreamChunk } from "@/types";
import { eligibleFallbackKeys } from "@/lib/provider-fallback";
import { logPerformanceMetric } from "@/lib/performance-logger";
import { providerOutputTokenBudget } from "@/lib/response-length";
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
import { selectCircuitAttempts, shortenRetryHistory } from "@/lib/provider-recovery";
import {
  readProviderCircuitStates,
  recordProviderFailure,
  recordProviderSuccess
} from "@/lib/provider-circuit";

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
  healthCheck?: boolean;
};

const APP_DEFAULT_MODELS = new Set(["gpt-4o-mini", "gpt-3.5-turbo"]);
const MAX_SAME_PROVIDER_ATTEMPTS = 4;
const keyCooldowns = new Map<string, number>();

type GatewayRoute = {
  provider: "openai" | "anthropic" | "gemini" | "openai-compatible";
  providerName: string;
  model: string;
  key?: ProviderKey;
};

export async function* streamGatewayResponse(input: StreamInput): AsyncGenerator<StreamChunk> {
  const keys = input.providerKeys ?? [];
  const initialRoute = routeModel(input.model, keys);
  const turnNumber = input.messages.filter((message) => message.role === "user").length;
  const observeOnly = input.healthCheck === true;
  const route = observeOnly ? initialRoute : rotatePrimaryKey(initialRoute, keys, `${input.userId}:${input.chatId}:${turnNumber}`);
  const candidateAttempts = attemptRoutes(route, keys, observeOnly);
  const circuitStates = observeOnly ? [] : await readProviderCircuitStates(candidateAttempts.map(circuitIdentity));
  const attempts = observeOnly ? [...candidateAttempts] : selectCircuitAttempts(candidateAttempts, circuitStates);
  if (attempts.length === 0) {
    logPerformanceMetric("llm_provider_circuit_blocked", {
      route: "chat:gateway",
      providerCount: new Set(candidateAttempts.map((attempt) => attempt.providerName)).size,
      attemptCount: candidateAttempts.length
    });
    yield {
      type: "error",
      message: "AI providers are cooling down after recent failures. Please retry shortly or choose another provider."
    };
    return;
  }
  const primaryKeyCount = keys.filter((key) => key.provider === route.providerName).length;
  let lastError: unknown = null;
  let lastAttempt = route;
  let promptMessages = input.messages;
  let contextRetried = false;
  const started = Date.now();
  const attemptLabels: string[] = [];
  const skippedProviders = new Set<string>();
  const gatewayDeadline = createTimeoutSignal(input.signal, LLM_PROVIDER_TIMEOUT_MS, "Provider request timed out.");

  try {
    for (const [index, attempt] of attempts.entries()) {
      if (gatewayDeadline.signal.aborted) {
        break;
      }
      if (skippedProviders.has(attempt.providerName)) {
        continue;
      }
      lastAttempt = attempt;

      let emittedText = false;
      let firstTokenLogged = false;
      const fallbackTriggered = candidateAttempts.indexOf(attempt) > 0;
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
          messages: promptMessages,
          temperature: input.temperature,
          topP: input.topP,
          frequencyPenalty: input.frequencyPenalty,
          presencePenalty: input.presencePenalty,
          maxTokens: providerOutputTokenBudget({
            visibleTokenLimit: input.maxTokens,
            provider: attempt.provider,
            model: attempt.model
          }),
          maxRetries: primaryKeyCount > 1 ? 0 : undefined,
          key: attempt.key,
          signal: attemptSignal.signal,
          writeDelta(delta) {
            outputText += delta;
            return delta;
          }
        });

        for await (const delta of abortableAsyncIterable(usage.deltas, attemptSignal.signal)) {
          emittedText = outputText.trim().length > 0;
          attemptSignal.reset(LLM_STREAM_IDLE_TIMEOUT_MS, "Provider stream stalled.");
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            logPerformanceMetric("llm_time_to_first_token", {
              route: "chat:gateway",
              provider: attempt.providerName,
              model: attempt.model,
              attempt: index + 1,
              keySlot: (attempt.key?.providerPriority ?? 0) + 1,
              fallbackTriggered,
              durationMs: Date.now() - started,
              providerLatencyMs: Date.now() - attemptStarted
            });
          }
          yield { type: "delta", text: delta };
        }

        if (!outputText.trim()) {
          throw new Error("Provider returned an empty response.");
        }

        const providerUsage = usage.getUsage();
        if (!observeOnly) {
          clearKeyCooldown(attempt.key);
          await recordProviderSuccess(circuitIdentity(attempt));
        }

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
          fallbackTriggered,
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
        if (!observeOnly) {
          setKeyCooldown(attempt.key, classified.code);
          await recordProviderFailure(circuitIdentity(attempt), classified.code);
        }
        if (!emittedText && classified.code === "prompt_too_large" && !contextRetried) {
          const shorter = shortenRetryHistory(promptMessages);
          if (shorter) {
            contextRetried = true;
            promptMessages = shorter;
            attempts.splice(index + 1, 0, attempt);
            continue;
          }
        }
        if (shouldSkipRemainingProviderKeys(classified.code)) {
          skippedProviders.add(attempt.providerName);
        }
        logSafeError(
          `LLM provider attempt failed (${attempt.providerName}:${attempt.model}, key slot ${(attempt.key?.providerPriority ?? 0) + 1}, ${classified.code}).`,
          lastError
        );
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
        if (emittedText) {
          yield { type: "error", message: "The model stream was interrupted." };
          return;
        }
        const nextAttempt = attempts.slice(index + 1).find((candidate) => !skippedProviders.has(candidate.providerName));
        const canTryAnotherRoute = Boolean(nextAttempt) && isKeyScopedFailure(classified.code);
        if (!classified.retryable && !canTryAnotherRoute) {
          yield {
            type: "error",
            message: exhaustedProviderMessage(attempt, classified.message)
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
  yield { type: "error", message: exhaustedProviderMessage(lastAttempt, classified.message) };
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

function attemptRoutes(primary: GatewayRoute, keys: ProviderKeys, ignoreCooldown = false) {
  const sameProvider = keys
    .filter((key) => key.provider === primary.providerName && key.id !== primary.key?.id && (ignoreCooldown || !isKeyCoolingDown(key)))
    .sort((left, right) =>
      (left.providerPriority ?? Number.MAX_SAFE_INTEGER) - (right.providerPriority ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, MAX_SAME_PROVIDER_ATTEMPTS - 1)
    .map((key) => routeFromKey(key, primary.model));
  return [primary, ...sameProvider, ...fallbackRoutes(primary, keys)];
}

function rotatePrimaryKey(primary: GatewayRoute, keys: ProviderKeys, seed: string) {
  if (!primary.key) return primary;

  const providerKeys = keys
    .filter((key) => key.provider === primary.providerName)
    .sort((left, right) =>
      (left.providerPriority ?? Number.MAX_SAFE_INTEGER) - (right.providerPriority ?? Number.MAX_SAFE_INTEGER)
    );
  const availableKeys = providerKeys.filter((key) => !isKeyCoolingDown(key));
  const candidates = availableKeys.length > 0 ? availableKeys : providerKeys;
  if (candidates.length < 2) return candidates[0] ? routeFromKey(candidates[0], primary.model) : primary;

  return routeFromKey(candidates[stableIndex(seed, candidates.length)], primary.model);
}

function stableIndex(seed: string, length: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16_777_619);
  }
  return Math.abs(hash) % length;
}

function keyIdentity(key?: ProviderKey) {
  if (!key) return null;
  return key.id ?? `${key.provider}:${key.providerPriority ?? 0}:${key.apiKey.slice(-8)}`;
}

function circuitIdentity(route: GatewayRoute) {
  return {
    provider: route.providerName,
    keyId: route.key?.id,
    model: route.model,
    credential: route.key?.apiKey ?? "unconfigured"
  };
}

function isKeyCoolingDown(key: ProviderKey) {
  const identity = keyIdentity(key);
  if (!identity) return false;
  const cooldownUntil = keyCooldowns.get(identity) ?? 0;
  if (cooldownUntil <= Date.now()) {
    keyCooldowns.delete(identity);
    return false;
  }
  return true;
}

function setKeyCooldown(key: ProviderKey | undefined, code: ReturnType<typeof classifyProviderError>["code"]) {
  const identity = keyIdentity(key);
  if (!identity) return;

  const duration = code === "rate_limit"
    ? 5 * 60_000
    : code === "invalid_api_key" || code === "insufficient_balance"
      ? 15 * 60_000
      : code === "provider_unavailable" || code === "network_error" || code === "provider_error"
        ? 30_000
        : 0;
  if (duration > 0) keyCooldowns.set(identity, Date.now() + duration);
}

function clearKeyCooldown(key?: ProviderKey) {
  const identity = keyIdentity(key);
  if (identity) keyCooldowns.delete(identity);
}

function isKeyScopedFailure(code: ReturnType<typeof classifyProviderError>["code"]) {
  return code === "invalid_api_key" ||
    code === "insufficient_balance" ||
    code === "prompt_too_large" ||
    code === "rate_limit" ||
    code === "model_unavailable" ||
    code === "provider_unavailable" ||
    code === "network_error" ||
    code === "provider_error";
}

function shouldSkipRemainingProviderKeys(code: ReturnType<typeof classifyProviderError>["code"]) {
  return code === "prompt_too_large" || code === "model_unavailable" ||
    code === "provider_unavailable" ||
    code === "network_error";
}

function exhaustedProviderMessage(route: GatewayRoute, fallbackMessage: string) {
  const provider = route.key?.displayName || route.providerName;
  return `${provider}: ${fallbackMessage}`;
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
      messages: input.messages.map<OpenAI.Chat.Completions.ChatCompletionMessageParam>((message) => {
        if (message.role !== "user" || !message.images?.length) {
          return { role: message.role, content: message.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam;
        }
        return {
          role: "user",
          content: [
            { type: "text", text: message.content || "Describe and use the attached image as scene context." },
            ...message.images.map((image) => ({
              type: "image_url" as const,
              image_url: { url: `data:${image.mediaType};base64,${image.data}` }
            }))
          ]
        };
      }),
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
    .map<Anthropic.MessageParam>((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: message.role === "user" && message.images?.length
        ? [
            { type: "text" as const, text: message.content || "Describe and use the attached image as scene context." },
            ...message.images.map((image) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: image.mediaType, data: image.data }
            }))
          ]
        : message.content
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
      parts: [
        { text: message.content || "Describe and use the attached image as scene context." },
        ...(message.images ?? []).map((image) => ({
          inlineData: { mimeType: image.mediaType, data: image.data }
        }))
      ]
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
