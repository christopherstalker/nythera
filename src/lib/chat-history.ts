import "server-only";

import type { MessageRole, RoomMessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimatePromptTokens, historyTokenBudget } from "@/lib/prompt-budget";
import { streamGatewayResponse } from "@/lib/llm-gateway";
import { titleFromMessage } from "@/lib/utils";
import type { ProviderKeys } from "@/lib/user-keys";

const HISTORY_BATCH_SIZE = 64;

export type PromptHistoryMessage = {
  id: string;
  role: MessageRole;
  content: string;
  sequence: number | null;
  clientRequestId: string | null;
};

export async function loadAdaptiveChatHistory(input: {
  chatId: string;
  model?: string | null;
  maxOutputTokens?: number | null;
  currentMessage: string;
  summary?: string | null;
}) {
  const fullHistoryBudget = historyTokenBudget({ ...input, summary: null });
  const newestFirst: PromptHistoryMessage[] = [];
  let estimatedTokens = 0;
  let offset = 0;
  let overflowed = false;

  while (!overflowed) {
    const batch = await prisma.message.findMany({
      where: { chatId: input.chatId },
      orderBy: [{ sequence: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: HISTORY_BATCH_SIZE,
      select: { id: true, role: true, content: true, sequence: true, clientRequestId: true }
    });

    if (batch.length === 0) {
      break;
    }

    for (const message of batch) {
      const messageTokens = estimatePromptTokens(message.content) + 8;
      if (estimatedTokens + messageTokens > fullHistoryBudget && newestFirst.length > 0) {
        overflowed = true;
        break;
      }
      newestFirst.push(message);
      estimatedTokens += messageTokens;
    }

    offset += batch.length;
    if (batch.length < HISTORY_BATCH_SIZE) {
      break;
    }
  }

  const tokenBudget = overflowed && input.summary ? historyTokenBudget(input) : fullHistoryBudget;
  while (newestFirst.length > 1 && estimatedTokens > tokenBudget) {
    const removed = newestFirst.pop();
    if (removed) {
      estimatedTokens -= estimatePromptTokens(removed.content) + 8;
    }
  }

  return {
    messages: newestFirst.reverse(),
    overflowed,
    estimatedTokens,
    tokenBudget
  };
}

export async function loadAdaptiveRoomHistory(input: {
  roomId: string;
  model?: string | null;
  maxOutputTokens?: number | null;
  currentMessage: string;
  summary?: string | null;
}) {
  const fullHistoryBudget = historyTokenBudget({ ...input, summary: null });
  const newestFirst: Array<{
    id: string;
    role: RoomMessageRole;
    content: string;
    sequence: number | null;
    characterId: string | null;
    character: { name: string } | null;
  }> = [];
  let estimatedTokens = 0;
  let offset = 0;
  let overflowed = false;

  while (!overflowed) {
    const batch = await prisma.roomMessage.findMany({
      where: { roomId: input.roomId },
      orderBy: [{ sequence: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: HISTORY_BATCH_SIZE,
      select: {
        id: true,
        role: true,
        content: true,
        sequence: true,
        characterId: true,
        character: { select: { name: true } }
      }
    });
    if (batch.length === 0) break;
    for (const message of batch) {
      const messageTokens = estimatePromptTokens(message.content) + 12;
      if (estimatedTokens + messageTokens > fullHistoryBudget && newestFirst.length > 0) {
        overflowed = true;
        break;
      }
      newestFirst.push(message);
      estimatedTokens += messageTokens;
    }
    offset += batch.length;
    if (batch.length < HISTORY_BATCH_SIZE) break;
  }

  const tokenBudget = overflowed && input.summary ? historyTokenBudget(input) : fullHistoryBudget;
  while (newestFirst.length > 1 && estimatedTokens > tokenBudget) {
    const removed = newestFirst.pop();
    if (removed) estimatedTokens -= estimatePromptTokens(removed.content) + 12;
  }

  return { messages: newestFirst.reverse(), overflowed, estimatedTokens, tokenBudget };
}

export async function generateChatTitle(input: {
  userMessage: string;
  assistantMessage: string;
  model: string;
  providerKeys?: ProviderKeys;
}) {
  const fallback = titleFromMessage(input.userMessage || input.assistantMessage || "New chat");

  try {
    let title = "";
    for await (const chunk of streamGatewayResponse({
      messages: [
        {
          role: "system",
          content: "Generate a concise chat title. Return only the title, 2-7 words, no quotes, no punctuation at the end."
        },
        {
          role: "user",
          content: `User: ${input.userMessage.slice(0, 500)}\nAssistant: ${input.assistantMessage.slice(0, 500)}`
        }
      ],
      model: input.model,
      temperature: 0.2,
      userId: "system-title",
      chatId: "system-title",
      providerKeys: input.providerKeys
    })) {
      if (chunk.type === "delta") {
        title += chunk.text;
      }
      if (chunk.type === "error") {
        throw new Error(chunk.message);
      }
    }

    return cleanTitle(title) || fallback;
  } catch (error) {
    console.warn("LLM title generation failed; using local fallback.", error instanceof Error ? error.message : error);
    return fallback;
  }
}

function cleanTitle(value: string) {
  return value
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!:;,-]+$/g, "")
    .slice(0, 54);
}
