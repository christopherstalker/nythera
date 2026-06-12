import "dotenv/config";

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import pino from "pino";
import { z } from "zod";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderKey = {
  provider: string;
  displayName: string;
  apiFormat: "OPENAI" | "ANTHROPIC" | "GEMINI" | "OPENAI_COMPATIBLE";
  apiKey: string;
  baseUrl?: string | null;
  defaultModel?: string | null;
};

type ProviderKeys = ProviderKey[];

type GatewayRoute = {
  provider: "openai" | "anthropic" | "gemini" | "openai-compatible" | "local";
  providerName: string;
  model: string;
  key?: ProviderKey;
};

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});

const app = express();
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT ?? 4000);
const internalToken = process.env.INTERNAL_API_TOKEN;

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
      displayName: z.string().min(1),
      apiFormat: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "OPENAI_COMPATIBLE"]),
      apiKey: z.string().min(1),
      baseUrl: z.string().nullable().optional(),
      defaultModel: z.string().nullable().optional()
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

  const openaiKey = parsed.data.providerKeys?.find((key) => key.apiFormat === "OPENAI" || key.provider === "openai");
  const requestOpenAI = openaiKey
    ? new OpenAI({ apiKey: openaiKey.apiKey, baseURL: openaiKey.baseUrl || "https://api.openai.com/v1" })
    : null;

  if (!requestOpenAI) {
    response.json({ embedding: deterministicEmbedding(parsed.data.text), provider: "local" });
    return;
  }

  const result = await requestOpenAI.embeddings.create({
    model: "text-embedding-3-small",
    input: parsed.data.text,
    dimensions: 1536
  });

  response.json({
    embedding: result.data[0].embedding,
    provider: "openai",
    model: "text-embedding-3-small"
  });
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
    connection: "keep-alive"
  });

  const providerKeys = parsed.data.providerKeys ?? [];
  const route = routeModel(parsed.data.model, providerKeys);
  const attempts = [route, ...fallbackRoutes(route, providerKeys)];
  let streamed = "";
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const usage = await streamProvider({
        provider: attempt.provider,
        model: attempt.model,
        messages: parsed.data.messages,
        temperature: parsed.data.temperature,
        key: attempt.key,
        writeDelta(delta) {
          const next = streamed + delta;
          const check = moderateText(next);
          if (!check.allowed) {
            throw new Error(check.reason);
          }

          streamed = next;
          response.write(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`);
        }
      });

      response.write(
        `data: ${JSON.stringify({
          type: "usage",
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          provider: attempt.providerName,
          model: attempt.model
        })}\n\n`
      );
      response.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      response.end();
      logger.info({
        route: "chat",
        provider: attempt.providerName,
        model: attempt.model,
        chatId: parsed.data.chatId,
        userId,
        latencyMs: Date.now() - started
      });
      return;
    } catch (error) {
      lastError = error;
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        provider: attempt.providerName,
        model: attempt.model
      });
      await delay(300);
    }
  }

  response.write(
    `data: ${JSON.stringify({
      type: "error",
      message: lastError instanceof Error ? lastError.message : "All model providers failed."
    })}\n\n`
  );
  response.end();
});

app.listen(port, () => {
  logger.info(`LLM proxy listening on http://localhost:${port}`);
});

function routeModel(requested: string, keys: ProviderKeys): GatewayRoute {
  const raw = requested.trim() || "gpt-4o-mini";
  const normalized = raw.toLowerCase();

  if (normalized.includes("local")) {
    return { provider: "local", providerName: "local", model: "local-dev-roleplay" };
  }

  const explicit = parseExplicitProviderModel(raw, keys);
  if (explicit) {
    return explicit;
  }

  const exactDefault = keys.find((key) => key.defaultModel?.toLowerCase() === normalized);
  if (exactDefault) {
    return routeFromKey(exactDefault, exactDefault.defaultModel || raw);
  }

  if (normalized.includes("claude")) {
    const key = keys.find((item) => item.apiFormat === "ANTHROPIC" || item.provider === "anthropic");
    return key ? routeFromKey(key, raw) : { provider: "anthropic", providerName: "anthropic", model: raw };
  }

  if (normalized.includes("gemini")) {
    const key = keys.find((item) => item.apiFormat === "GEMINI" || item.provider === "gemini");
    return key ? routeFromKey(key, raw) : { provider: "gemini", providerName: "gemini", model: raw };
  }

  if (normalized.includes("4o") || normalized.includes("gpt-4")) {
    const key = keys.find((item) => item.apiFormat === "OPENAI" || item.provider === "openai");
    return key ? routeFromKey(key, raw) : { provider: "openai", providerName: "openai", model: raw };
  }

  const defaultKey = keys.find((key) => key.defaultModel) ?? keys[0];
  if (defaultKey) {
    return routeFromKey(defaultKey, defaultKey.defaultModel || raw);
  }

  return { provider: "local", providerName: "local", model: "local-dev-roleplay" };
}

function fallbackRoutes(primary: GatewayRoute, keys: ProviderKeys) {
  const routes = keys.map((key) => routeFromKey(key, key.defaultModel || "gpt-4o-mini"));
  routes.push({ provider: "local", providerName: "local", model: "local-dev-roleplay" });

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
  provider: "openai" | "anthropic" | "gemini" | "openai-compatible" | "local";
  model: string;
  messages: ChatMessage[];
  temperature: number;
  key?: ProviderKey;
  writeDelta: (delta: string) => void;
}) {
  if (input.provider === "openai" || input.provider === "openai-compatible") {
    const client = input.key?.apiKey
      ? new OpenAI({
          apiKey: input.key.apiKey,
          baseURL:
            input.provider === "openai"
              ? input.key.baseUrl || "https://api.openai.com/v1"
              : requireBaseUrl(input.key)
        })
      : null;
    if (!client) {
      throw new Error(`${input.provider} is not configured.`);
    }

    return streamOpenAI({ ...input, client });
  }

  if (input.provider === "anthropic") {
    const client = input.key?.apiKey ? new Anthropic({ apiKey: input.key.apiKey }) : null;
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

  return streamLocal(input);
}

function requireBaseUrl(key: ProviderKey) {
  if (!key.baseUrl) {
    throw new Error(`Base URL is required for ${key.displayName}.`);
  }

  return key.baseUrl;
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
      defaultModel: "gemini-1.5-flash"
    });
  }

  return result;
}

async function streamOpenAI(input: {
  client: OpenAI;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  writeDelta: (delta: string) => void;
}) {
  const client = input.client;
  const anyClient = client as unknown as {
    responses?: {
      stream: (args: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>;
    };
  };

  if (anyClient.responses?.stream) {
    const stream = anyClient.responses.stream({
      model: input.model,
      input: input.messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      temperature: input.temperature
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        input.writeDelta(event.delta);
      }
    }
  } else {
    const stream = await client.chat.completions.create({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        input.writeDelta(delta);
      }
    }
  }

  return {
    inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens: 0
  };
}

async function streamAnthropic(input: {
  client: Anthropic;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  writeDelta: (delta: string) => void;
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
      input.writeDelta(event.delta.text);
    }
  }

  return {
    inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens: 0
  };
}

async function streamGemini(input: {
  client: GoogleGenerativeAI;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  writeDelta: (delta: string) => void;
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
      input.writeDelta(text);
    }
  }

  return {
    inputTokens: estimateTokens(prompt),
    outputTokens: 0
  };
}

async function streamLocal(input: {
  messages: ChatMessage[];
  writeDelta: (delta: string) => void;
}) {
  const final = input.messages.at(-1)?.content ?? "";
  const text = `Local proxy fallback is active. I received: "${final.slice(
    0,
    180
  )}". Add your own model key in Velora settings to use live model streaming.`;

  for (const part of text.split(/(\s+)/)) {
    await delay(18);
    input.writeDelta(part);
  }

  return {
    inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens: estimateTokens(text)
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
