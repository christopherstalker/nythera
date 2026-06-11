import { env } from "@/lib/env";
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

export async function* streamLlmResponse(input: StreamInput): AsyncGenerator<StreamChunk> {
  if (!env.LLM_PROXY_URL || !env.INTERNAL_API_TOKEN) {
    yield* fallbackStream(input);
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
      yield* fallbackStream(input);
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
    console.error("LLM proxy failed, using local fallback.", error);
    yield* fallbackStream(input);
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

  return deterministicEmbedding(text);
}

async function* fallbackStream(input: StreamInput): AsyncGenerator<StreamChunk> {
  const userMessage = input.messages.at(-1)?.content ?? "";
  const characterHint = input.messages[0]?.content.match(/^You are ([^.]+)\./)?.[1] ?? "your character";
  const text = `${characterHint} studies your words for a moment. "${userMessage.slice(
    0,
    160
  )}" gives them enough to answer in character. Add your own model key in Velora settings to switch this local fallback to a live provider. The pipeline is active: moderation, memory retrieval, prompt assembly, streaming, and persistence are all being exercised.`;

  for (const word of text.split(/(\s+)/)) {
    await sleep(20);
    yield { type: "delta", text: word };
  }

  yield {
    type: "usage",
    inputTokens: estimateTokens(input.messages.map((message) => message.content).join("\n")),
    outputTokens: estimateTokens(text),
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
