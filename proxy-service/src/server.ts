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

type ProviderKeys = {
  openai?: string;
  anthropic?: string;
  gemini?: string;
};

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});

const app = express();
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT ?? 4000);
const internalToken = process.env.INTERNAL_API_TOKEN;

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string().min(1).max(8000)
    })
  ),
  model: z.string().default("gpt-3.5-turbo"),
  temperature: z.number().min(0).max(2).default(0.7),
  userId: z.string().optional(),
  chatId: z.string().optional(),
  providerKeys: z
    .object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
      gemini: z.string().optional()
    })
    .optional()
});

const embeddingSchema = z.object({
  text: z.string().min(1).max(8000),
  providerKeys: z
    .object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
      gemini: z.string().optional()
    })
    .optional()
});

const counters = new Map<string, { count: number; expiresAt: number }>();

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    providers: {
      openai: "byok",
      anthropic: "byok",
      gemini: "byok"
    }
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

  const requestOpenAI = parsed.data.providerKeys?.openai
    ? new OpenAI({ apiKey: parsed.data.providerKeys.openai })
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

  const route = routeModel(parsed.data.model);
  const attempts = [route, ...fallbackRoutes(route)];
  let streamed = "";
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const usage = await streamProvider({
        provider: attempt.provider,
        model: attempt.model,
        messages: parsed.data.messages,
        temperature: parsed.data.temperature,
        providerKeys: parsed.data.providerKeys,
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
          provider: attempt.provider,
          model: attempt.model
        })}\n\n`
      );
      response.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      response.end();
      logger.info({
        route: "chat",
        provider: attempt.provider,
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
        provider: attempt.provider,
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

function routeModel(requested: string): { provider: "openai" | "anthropic" | "gemini" | "local"; model: string } {
  const normalized = requested.toLowerCase();

  if (normalized.includes("local")) {
    return { provider: "local", model: "local-dev-roleplay" };
  }

  if (normalized.includes("claude")) {
    return { provider: "anthropic", model: requested };
  }

  if (normalized.includes("gemini")) {
    return { provider: "gemini", model: requested };
  }

  if (normalized.includes("4o") || normalized.includes("gpt-4")) {
    return { provider: "openai", model: requested };
  }

  return { provider: "openai", model: requested || "gpt-3.5-turbo" };
}

function fallbackRoutes(primary: { provider: string; model: string }) {
  return [
    { provider: "openai" as const, model: "gpt-4o-mini" },
    { provider: "anthropic" as const, model: "claude-3-5-sonnet-latest" },
    { provider: "gemini" as const, model: "gemini-1.5-flash" },
    { provider: "local" as const, model: "local-dev-roleplay" }
  ].filter((route) => route.provider !== primary.provider || route.model !== primary.model);
}

async function streamProvider(input: {
  provider: "openai" | "anthropic" | "gemini" | "local";
  model: string;
  messages: ChatMessage[];
  temperature: number;
  providerKeys?: ProviderKeys;
  writeDelta: (delta: string) => void;
}) {
  if (input.provider === "openai") {
    const client = input.providerKeys?.openai ? new OpenAI({ apiKey: input.providerKeys.openai }) : null;
    if (!client) {
      throw new Error("OpenAI is not configured.");
    }

    return streamOpenAI({ ...input, client });
  }

  if (input.provider === "anthropic") {
    const client = input.providerKeys?.anthropic ? new Anthropic({ apiKey: input.providerKeys.anthropic }) : null;
    if (!client) {
      throw new Error("Anthropic is not configured.");
    }

    return streamAnthropic({ ...input, client });
  }

  if (input.provider === "gemini") {
    const client = input.providerKeys?.gemini ? new GoogleGenerativeAI(input.providerKeys.gemini) : null;
    if (!client) {
      throw new Error("Gemini is not configured.");
    }

    return streamGemini({ ...input, client });
  }

  return streamLocal(input);
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
