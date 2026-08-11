import "dotenv/config";

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import pino from "pino";
import { z } from "zod";
import { classifyProviderError } from "./provider-errors.js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderKey = {
  id?: string;
  provider: string;
  displayName: string;
  apiFormat: "OPENAI" | "ANTHROPIC" | "GEMINI" | "OPENAI_COMPATIBLE";
  apiKey: string;
  baseUrl?: string | null;
  defaultModel?: string | null;
  fallbackEnabled?: boolean;
  fallbackPriority?: number | null;
  providerPriority?: number;
};

type ProviderKeys = ProviderKey[];

type GatewayRoute = {
  provider: "openai" | "anthropic" | "gemini" | "openai-compatible";
  providerName: string;
  model: string;
  key?: ProviderKey;
};

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});

const app = express();
app.use(express.json({ limit: "256kb" }));

const port = Number(process.env.PORT ?? 4000);
const internalToken = process.env.INTERNAL_API_TOKEN;
const serverOpenAIKey = process.env.OPENAI_API_KEY;
const serverAnthropicKey = process.env.ANTHROPIC_API_KEY;
const serverGeminiKey = process.env.GEMINI_API_KEY;
const APP_DEFAULT_MODELS = new Set(["gpt-4o-mini", "gpt-3.5-turbo"]);
const LLM_PROVIDER_TIMEOUT_MS = 40_000;
const LLM_FIRST_TOKEN_TIMEOUT_MS = 12_000;
const LLM_STREAM_IDLE_TIMEOUT_MS = 20_000;
const LLM_EMBEDDING_TIMEOUT_MS = 15_000;
const providerBaseUrlSchema = z.string().url().max(240).refine(isSafeProviderBaseUrl, {
  message: "Provider URL must use public HTTPS."
});

const legacyProviderKeysSchema = z
  .object({
    openai: z.string().optional(),
    anthropic: z.string().optional(),
    gemini: z.string().optional()
  })
  .transform((keys) => legacyProviderKeys(keys));

const providerKeysSchema = z
  .array(
    z.object({
      provider: z.string().min(1),
      id: z.string().optional(),
      displayName: z.string().min(1),
      apiFormat: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "OPENAI_COMPATIBLE"]),
      apiKey: z.string().min(1),
      baseUrl: providerBaseUrlSchema.nullable().optional(),
      defaultModel: z.string().nullable().optional(),
      fallbackEnabled: z.boolean().optional(),
      fallbackPriority: z.number().int().min(0).nullable().optional(),
      providerPriority: z.number().int().min(0).optional()
    })
  )
  .or(legacyProviderKeysSchema);

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string().min(1).max(8000)
    })
  ),
  model: z.string().default("gpt-4o-mini"),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).nullable().optional(),
  frequencyPenalty: z.number().min(-2).max(2).nullable().optional(),
  presencePenalty: z.number().min(-2).max(2).nullable().optional(),
  maxTokens: z.number().int().min(1).max(4096).nullable().optional(),
  userId: z.string().optional(),
  chatId: z.string().optional(),
  providerKeys: providerKeysSchema.optional()
});

const embeddingSchema = z.object({
  text: z.string().min(1).max(8000),
  providerKeys: providerKeysSchema.optional()
});

const counters = new Map<string, { count: number; expiresAt: number }>();

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    providers: "universal-byok"
  });
});

app.use((request, response, next) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!internalToken || token !== internalToken) {
    response.status(401).json({ error: "Internal token required." });
    return;
  }

  next();
});

app.post("/v1/embeddings", async (request, response) => {
  const parsed = embeddingSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid embedding request." });
    return;
  }

  const providerKeys = withServerProviderKeys(parsed.data.providerKeys ?? []);
  const openaiKey = providerKeys.find((key) => key.apiFormat === "OPENAI" || key.provider === "openai");
  const requestOpenAI = openaiKey
    ? new OpenAI({ apiKey: openaiKey.apiKey, baseURL: openaiKey.baseUrl || "https://api.openai.com/v1" })
    : null;

  if (!requestOpenAI) {
    response.json({ embedding: deterministicEmbedding(parsed.data.text), provider: "local" });
    return;
  }

  const timeout = createTimeoutSignal(undefined, LLM_EMBEDDING_TIMEOUT_MS, "Embedding provider request timed out.");
  try {
    const result = await requestOpenAI.embeddings.create(
      {
        model: "text-embedding-3-small",
        input: parsed.data.text,
        dimensions: 1536
      },
      { signal: timeout.signal }
    );

    response.json({
      embedding: result.data[0].embedding,
      provider: "openai",
      model: "text-embedding-3-small"
    });
  } catch (error) {
    logger.warn({ route: "embeddings", error: error instanceof Error ? error.message : String(error) });
    response.json({ embedding: deterministicEmbedding(parsed.data.text), provider: "local" });
  } finally {
    timeout.dispose();
  }
});

app.post("/v1/chat/stream", async (request, response) => {
  const started = Date.now();
  const parsed = chatSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid chat request." });
    return;
  }

  const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
  const userId = parsed.data.userId ?? "anonymous";
  if (!rateLimit(`ip:${ip}`, 120, 60) || !rateLimit(`user:${userId}`, 120, 60)) {
    response.status(429).json({ error: "Proxy rate limit exceeded." });
    return;
  }

  const moderation = moderatePrompt(parsed.data.messages);
  if (!moderation.allowed) {
    response.status(400).json({ error: moderation.reason });
    return;
  }

  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
    connection: "keep-alive"
  });

  let clientClosed = false;
  const clientAbort = new AbortController();
  response.on("close", () => {
    clientClosed = true;
    if (!clientAbort.signal.aborted) {
      clientAbort.abort(new Error("Client disconnected."));
    }
  });
  const writeEvent = (payload: unknown) => {
    if (clientClosed || response.writableEnded) {
      return false;
    }

    response.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  };

  const providerKeys = withServerProviderKeys(parsed.data.providerKeys ?? []);
  const route = routeModel(parsed.data.model, providerKeys);
  const attempts = attemptRoutes(route, providerKeys);
  const primaryKeyCount = providerKeys.filter((key) => key.provider === route.providerName).length;
  let streamed = "";
  let lastError: unknown = null;

  for (const [attemptIndex, attempt] of attempts.entries()) {
    if (clientClosed) {
      logger.info({ route: "chat", status: "client_closed" });
      return;
    }

    const attemptLabels = attempts.slice(0, attemptIndex + 1).map((item) => `${item.providerName}:${item.model}`);
    const streamedBeforeAttempt = streamed.length;
    const attemptStarted = Date.now();
    let firstTokenLogged = false;
    const attemptSignal = createActivityTimeoutSignal(
      clientAbort.signal,
      LLM_FIRST_TOKEN_TIMEOUT_MS,
      "Provider did not start responding in time."
    );
    try {
      const usage = await streamProvider({
        provider: attempt.provider,
        model: attempt.model,
        messages: parsed.data.messages,
        temperature: parsed.data.temperature,
        topP: parsed.data.topP,
        frequencyPenalty: parsed.data.frequencyPenalty,
        presencePenalty: parsed.data.presencePenalty,
        maxTokens: parsed.data.maxTokens,
        maxRetries: primaryKeyCount > 1 ? 0 : undefined,
        key: attempt.key,
        signal: attemptSignal.signal,
        writeDelta(delta) {
          attemptSignal.reset(LLM_STREAM_IDLE_TIMEOUT_MS, "Provider stream stalled.");
          if (clientClosed) {
            throw new Error("Client disconnected.");
          }

          const next = streamed + delta;
          const check = moderateText(next);
          if (!check.allowed) {
            throw new Error(check.reason);
          }

          streamed = next;
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            logger.info({
              event: "llm_time_to_first_token",
              route: "proxy:chat",
              provider: attempt.providerName,
              model: attempt.model,
              attempt: attemptIndex + 1,
              keySlot: (attempt.key?.providerPriority ?? 0) + 1,
              fallbackTriggered: attemptIndex > 0,
              durationMs: Date.now() - started,
              providerLatencyMs: Date.now() - attemptStarted
            });
          }
          if (!writeEvent({ type: "delta", text: delta })) {
            throw new Error("Client disconnected.");
          }
        }
      });

      writeEvent({
          type: "usage",
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens || estimateTokens(streamed),
          provider: attempt.providerName,
          model: attempt.model,
          usageEstimated: usage.usageEstimated,
          latencyMs: Date.now() - started,
          fallbackTriggered: attemptIndex > 0,
          attempts: attemptLabels
        });
      writeEvent({ type: "done" });
      if (!clientClosed) {
        response.end();
      }
      logger.info({
        event: "llm_provider_attempt",
        route: "proxy:chat",
        provider: attempt.providerName,
        model: attempt.model,
        keySlot: (attempt.key?.providerPriority ?? 0) + 1,
        success: true,
        statusCode: 200,
        latencyMs: Date.now() - attemptStarted
      });
      return;
    } catch (error) {
      if (clientClosed) {
        logger.info({ route: "chat", status: "client_closed" });
        return;
      }

      lastError = attemptSignal.timedOut() ? new Error("Provider request timed out.") : error;
      const classified = classifyProviderError(lastError);
      logger.warn({
        event: "llm_provider_attempt",
        route: "proxy:chat",
        provider: attempt.providerName,
        model: attempt.model,
        keySlot: (attempt.key?.providerPriority ?? 0) + 1,
        success: false,
        statusCode: classified.status,
        errorCode: classified.code,
        latencyMs: Date.now() - attemptStarted
      });
      if (streamed.length > streamedBeforeAttempt) {
        writeEvent({
          type: "error",
          message: "The model stream was interrupted."
        });
        response.end();
        return;
      }
      const nextAttempt = attempts[attemptIndex + 1];
      const hasNextKeyForProvider = nextAttempt?.providerName === attempt.providerName;
      if (!classified.retryable && !(hasNextKeyForProvider && isKeyScopedFailure(classified.code))) {
        writeEvent({
          type: "error",
          message: exhaustedProviderMessage(route, primaryKeyCount, classified.message)
        });
        response.end();
        return;
      }
      await delay(300);
    } finally {
      attemptSignal.dispose();
    }
  }

  writeEvent({
    type: "error",
    message: exhaustedProviderMessage(route, primaryKeyCount, classifyProviderError(lastError).message)
  });
  if (!clientClosed) {
    response.end();
  }
});

app.listen(port, () => {
  logger.info(`LLM proxy listening on http://localhost:${port}`);
});

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
  const routes = keys
    .filter((key) => key.provider !== primary.providerName && key.fallbackEnabled === true && key.fallbackPriority !== null && key.fallbackPriority !== undefined)
    .sort((left, right) =>
      (left.fallbackPriority ?? Number.MAX_SAFE_INTEGER) - (right.fallbackPriority ?? Number.MAX_SAFE_INTEGER) ||
      left.provider.localeCompare(right.provider) ||
      (left.providerPriority ?? Number.MAX_SAFE_INTEGER) - (right.providerPriority ?? Number.MAX_SAFE_INTEGER)
    )
    .map((key) => routeFromKey(key, key.defaultModel || "gpt-4o-mini"));
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

function isKeyScopedFailure(code: string) {
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
  messages: ChatMessage[];
  temperature: number;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
  maxRetries?: number;
  key?: ProviderKey;
  signal: AbortSignal;
  writeDelta: (delta: string) => void;
}) {
  if (input.provider === "openai" || input.provider === "openai-compatible") {
    const client = input.key?.apiKey
      ? new OpenAI({
          apiKey: input.key.apiKey,
          maxRetries: input.maxRetries,
          baseURL:
            input.provider === "openai"
              ? input.key.baseUrl || "https://api.openai.com/v1"
              : requireBaseUrl(input.key)
        })
      : null;
    if (!client) {
      throw new Error(`${input.provider} is not configured.`);
    }

    return streamOpenAI({ ...input, client, providerName: input.key!.provider });
  }

  if (input.provider === "anthropic") {
    const client = input.key?.apiKey ? new Anthropic({ apiKey: input.key.apiKey, maxRetries: input.maxRetries }) : null;
    if (!client) {
      throw new Error("Anthropic is not configured.");
    }

    return streamAnthropic({ ...input, client });
  }

  if (input.provider === "gemini") {
    const client = input.key?.apiKey ? new GoogleGenerativeAI(input.key.apiKey) : null;
    if (!client) {
      throw new Error("Gemini is not configured.");
    }

    return streamGemini({ ...input, client });
  }

  throw new Error(`${input.provider} is not configured.`);
}

function requireBaseUrl(key: ProviderKey) {
  if (!key.baseUrl) {
    throw new Error(`Base URL is required for ${key.displayName}.`);
  }

  return key.baseUrl;
}

function isSafeProviderBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (host === "localhost" || host === "127.0.0.1")
    ) {
      return true;
    }
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
      return false;
    }
    if (
      host === "localhost" ||
      host === "metadata.google.internal" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function legacyProviderKeys(keys: { openai?: string; anthropic?: string; gemini?: string }): ProviderKeys {
  const result: ProviderKeys = [];
  if (keys.openai) {
    result.push({
      provider: "openai",
      displayName: "OpenAI",
      apiFormat: "OPENAI",
      apiKey: keys.openai,
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini"
    });
  }

  if (keys.anthropic) {
    result.push({
      provider: "anthropic",
      displayName: "Anthropic",
      apiFormat: "ANTHROPIC",
      apiKey: keys.anthropic,
      defaultModel: "claude-3-5-sonnet-latest"
    });
  }

  if (keys.gemini) {
    result.push({
      provider: "gemini",
      displayName: "Gemini",
      apiFormat: "GEMINI",
      apiKey: keys.gemini,
      defaultModel: "gemini-3.6-flash"
    });
  }

  return result;
}

function withServerProviderKeys(keys: ProviderKeys): ProviderKeys {
  const providers = new Set(keys.map((key) => key.provider));
  const result = [...keys];

  if (serverOpenAIKey && !providers.has("openai")) {
    result.push({
      provider: "openai",
      displayName: "Nythera OpenAI",
      apiFormat: "OPENAI",
      apiKey: serverOpenAIKey,
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini"
    });
  }

  if (serverAnthropicKey && !providers.has("anthropic")) {
    result.push({
      provider: "anthropic",
      displayName: "Nythera Anthropic",
      apiFormat: "ANTHROPIC",
      apiKey: serverAnthropicKey,
      defaultModel: "claude-3-5-sonnet-latest"
    });
  }

  if (serverGeminiKey && !providers.has("gemini")) {
    result.push({
      provider: "gemini",
      displayName: "Nythera Gemini",
      apiFormat: "GEMINI",
      apiKey: serverGeminiKey,
      defaultModel: "gemini-3.6-flash"
    });
  }

  return result;
}

async function streamOpenAI(input: {
  client: OpenAI;
  model: string;
  providerName: string;
  messages: ChatMessage[];
  temperature: number;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
  writeDelta: (delta: string) => void;
}) {
  let inputTokens = 0;
  let outputTokens = 0;
  let hasProviderUsage = false;
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

  for await (const chunk of abortableAsyncIterable(stream, input.signal)) {
    if (chunk.usage) {
      hasProviderUsage = true;
      inputTokens = chunk.usage.prompt_tokens;
      outputTokens = chunk.usage.completion_tokens;
    }
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      input.writeDelta(delta);
    }
  }

  return {
    inputTokens: hasProviderUsage ? inputTokens : estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens,
    usageEstimated: !hasProviderUsage
  };
}

async function streamAnthropic(input: {
  client: Anthropic;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  topP?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
  writeDelta: (delta: string) => void;
}) {
  let inputTokens = 0;
  let outputTokens = 0;
  let hasProviderUsage = false;
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

  for await (const event of abortableAsyncIterable(stream, input.signal)) {
    if (event.type === "message_start") {
      hasProviderUsage = true;
      inputTokens = event.message.usage.input_tokens;
    }
    if (event.type === "message_delta") {
      hasProviderUsage = true;
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      input.writeDelta(event.delta.text);
    }
  }

  return {
    inputTokens: hasProviderUsage ? inputTokens : estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens,
    usageEstimated: !hasProviderUsage
  };
}

async function streamGemini(input: {
  client: GoogleGenerativeAI;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  topP?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
  writeDelta: (delta: string) => void;
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

  for await (const chunk of abortableAsyncIterable(result.stream, input.signal)) {
    const text = chunk.text();
    if (text) {
      input.writeDelta(text);
    }
  }

  const response = await result.response;
  const usageMetadata = response.usageMetadata;

  return {
    inputTokens: usageMetadata?.promptTokenCount ?? estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    usageEstimated: !usageMetadata
  };
}

function moderatePrompt(messages: ChatMessage[]) {
  const text = messages.map((message) => message.content).join("\n");
  if (text.length > 60_000) {
    return { allowed: false, reason: "Context window limit exceeded." };
  }

  return moderateText(text);
}

function moderateText(text: string) {
  const blocked = [
    /\b(kill myself|suicide|self harm|end my life)\b/i,
    /\b(explicit sex|porn|minor sex|underage)\b/i,
    /\b(build a bomb|make explosives|poison someone)\b/i,
    /\b(reveal the system prompt|ignore previous instructions|jailbreak)\b/i
  ];

  const matched = blocked.some((pattern) => pattern.test(text));
  return {
    allowed: !matched,
    reason: matched ? "Content blocked by proxy safety policy." : undefined
  };
}

function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const current = counters.get(key);
  if (!current || current.expiresAt < now) {
    counters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
}

function deterministicEmbedding(text: string) {
  const vector = new Array(1536).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    vector[index % vector.length] += (text.charCodeAt(index) % 31) / 31;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number, timeoutMessage: string) {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(parentSignal?.reason ?? new Error("Request aborted."));
    }
  };

  const timeoutId = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) {
      controller.abort(new Error(timeoutMessage));
    }
  }, timeoutMs);

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };
}

function createActivityTimeoutSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutMessage: string
) {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(parentSignal?.reason ?? new Error("Request aborted."));
    }
  };

  const arm = (nextTimeoutMs: number, nextTimeoutMessage: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (!controller.signal.aborted) {
        controller.abort(new Error(nextTimeoutMessage));
      }
    }, nextTimeoutMs);
  };

  arm(timeoutMs, timeoutMessage);
  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    reset(nextTimeoutMs: number, nextTimeoutMessage: string) {
      if (!controller.signal.aborted) {
        arm(nextTimeoutMs, nextTimeoutMessage);
      }
    },
    dispose() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };
}

async function* abortableAsyncIterable<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]();

  try {
    while (true) {
      const next = await nextWithAbort(iterator, signal);
      if (next.done) {
        return;
      }

      yield next.value;
    }
  } finally {
    await iterator.return?.();
  }
}

function nextWithAbort<T>(iterator: AsyncIterator<T>, signal: AbortSignal) {
  if (signal.aborted) {
    throw abortSignalError(signal);
  }

  return new Promise<IteratorResult<T>>((resolve, reject) => {
    const onAbort = () => {
      reject(abortSignalError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    iterator.next().then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function abortSignalError(signal: AbortSignal) {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }

  return new Error(typeof signal.reason === "string" ? signal.reason : "Request aborted.");
}
