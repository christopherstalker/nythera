import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { sleep } from "@/lib/utils";
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

const FALLBACK_MODEL = "local-dev-roleplay";

export async function* streamGatewayResponse(input: StreamInput): AsyncGenerator<StreamChunk> {
  const route = routeModel(input.model);
  const attempts = [route, ...fallbackRoutes(route)];
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      let outputText = "";
      const usage = await streamProvider({
        provider: attempt.provider,
        model: attempt.model,
        messages: input.messages,
        temperature: input.temperature,
        providerKeys: input.providerKeys,
        writeDelta(delta) {
          outputText += delta;
          return delta;
        }
      });

      for await (const delta of usage.deltas) {
        yield { type: "delta", text: delta };
      }

      yield {
        type: "usage",
        inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
        outputTokens: estimateTokens(outputText),
        provider: attempt.provider,
        model: attempt.model
      };
      yield { type: "done" };
      return;
    } catch (error) {
      lastError = error;
    }
  }

  console.error("All gateway providers failed, using local fallback.", lastError);
  yield* fallbackStream(input);
}

export async function createGatewayEmbedding(text: string, providerKeys?: ProviderKeys) {
  if (providerKeys?.openai) {
    try {
      const openai = new OpenAI({ apiKey: providerKeys.openai });
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

function routeModel(requested: string): { provider: "openai" | "anthropic" | "gemini" | "local"; model: string } {
  const normalized = requested.toLowerCase();

  if (normalized.includes("local")) {
    return { provider: "local", model: FALLBACK_MODEL };
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

  return { provider: "openai", model: requested || "gpt-4o-mini" };
}

function fallbackRoutes(primary: { provider: string; model: string }) {
  return [
    { provider: "openai" as const, model: "gpt-4o-mini" },
    { provider: "anthropic" as const, model: "claude-3-5-sonnet-latest" },
    { provider: "gemini" as const, model: "gemini-1.5-flash" },
    { provider: "local" as const, model: FALLBACK_MODEL }
  ].filter((route) => route.provider !== primary.provider || route.model !== primary.model);
}

async function streamProvider(input: {
  provider: "openai" | "anthropic" | "gemini" | "local";
  model: string;
  messages: PromptMessage[];
  temperature: number;
  providerKeys?: ProviderKeys;
  writeDelta: (delta: string) => string;
}) {
  if (input.provider === "openai") {
    if (!input.providerKeys?.openai) {
      throw new Error("OpenAI is not configured.");
    }

    return {
      deltas: streamOpenAI({
        client: new OpenAI({ apiKey: input.providerKeys.openai }),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        writeDelta: input.writeDelta
      })
    };
  }

  if (input.provider === "anthropic") {
    if (!input.providerKeys?.anthropic) {
      throw new Error("Anthropic is not configured.");
    }

    return {
      deltas: streamAnthropic({
        client: new Anthropic({ apiKey: input.providerKeys.anthropic }),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        writeDelta: input.writeDelta
      })
    };
  }

  if (input.provider === "gemini") {
    if (!input.providerKeys?.gemini) {
      throw new Error("Gemini is not configured.");
    }

    return {
      deltas: streamGemini({
        client: new GoogleGenerativeAI(input.providerKeys.gemini),
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        writeDelta: input.writeDelta
      })
    };
  }

  return {
    deltas: streamLocalDeltas(input.messages, input.writeDelta)
  };
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

async function* streamLocalDeltas(messages: PromptMessage[], writeDelta: (delta: string) => string) {
  const final = messages.at(-1)?.content ?? "";
  const text = `Local proxy fallback is active. I received: "${final.slice(
    0,
    180
  )}". Add your own model key in Velora settings to use live model streaming.`;

  for (const part of text.split(/(\s+)/)) {
    await sleep(18);
    yield writeDelta(part);
  }
}

async function* fallbackStream(input: StreamInput): AsyncGenerator<StreamChunk> {
  let outputText = "";
  for await (const delta of streamLocalDeltas(input.messages, (text) => {
    outputText += text;
    return text;
  })) {
    yield { type: "delta", text: delta };
  }

  yield {
    type: "usage",
    inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens: estimateTokens(outputText),
    model: FALLBACK_MODEL,
    provider: "local"
  };
  yield { type: "done" };
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
