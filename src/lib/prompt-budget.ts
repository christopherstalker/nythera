import { modelContextWindow, splitProviderModelValue } from "@/lib/provider-model-options";
import type { PromptMessage } from "@/types";

const TOKEN_SAFETY_MARGIN = 1_024;
const FIXED_PROMPT_RESERVE = 4_000;
const PROMPT_MESSAGE_OVERHEAD = 8;
const IMAGE_TOKEN_RESERVE = 2_048;
const OPENROUTER_RELIABLE_CONTEXT_WINDOW = 30_000;

export function estimatePromptTokens(value: string) {
  return Math.ceil(value.length / 4);
}

export function promptContextWindow(model?: string | null) {
  const advertisedWindow = modelContextWindow(model);
  const provider = splitProviderModelValue(model)?.provider;

  // Accounts without OpenRouter credits are capped at 32K even when a model advertises a larger window.
  return provider === "openrouter"
    ? Math.min(advertisedWindow, OPENROUTER_RELIABLE_CONTEXT_WINDOW)
    : advertisedWindow;
}

export function historyTokenBudget(input: {
  model?: string | null;
  maxOutputTokens?: number | null;
  currentMessage: string;
  summary?: string | null;
}) {
  const outputReserve = Math.max(256, input.maxOutputTokens ?? 900);
  const usedOutsideHistory =
    outputReserve +
    TOKEN_SAFETY_MARGIN +
    FIXED_PROMPT_RESERVE +
    estimatePromptTokens(input.currentMessage) +
    estimatePromptTokens(input.summary ?? "");
  return Math.max(512, promptContextWindow(input.model) - usedOutsideHistory);
}

export function selectNewestHistoryWithinBudget<T extends { content: string }>(newestFirst: T[], tokenBudget: number) {
  const selected: T[] = [];
  let estimatedTokens = 0;
  let overflowed = false;

  for (const message of newestFirst) {
    const messageTokens = estimatePromptTokens(message.content.slice(0, 2_600)) + 8;
    if (estimatedTokens + messageTokens > tokenBudget && selected.length > 0) {
      overflowed = true;
      break;
    }
    selected.push(message);
    estimatedTokens += messageTokens;
  }

  return { selected, estimatedTokens, overflowed };
}

function estimatePromptMessageTokens(message: PromptMessage) {
  return estimatePromptTokens(message.content) + PROMPT_MESSAGE_OVERHEAD + (message.images?.length ?? 0) * IMAGE_TOKEN_RESERVE;
}

export function fitPromptMessagesWithinContext(
  messages: PromptMessage[],
  input: { model?: string | null; maxOutputTokens?: number | null }
) {
  const outputReserve = Math.max(256, input.maxOutputTokens ?? 900);
  const tokenBudget = Math.max(512, promptContextWindow(input.model) - outputReserve - TOKEN_SAFETY_MARGIN);
  const fittedMessages = [...messages];
  let estimatedTokens = fittedMessages.reduce((total, message) => total + estimatePromptMessageTokens(message), 0);
  let droppedMessages = 0;

  while (estimatedTokens > tokenBudget && fittedMessages.length > 2) {
    const [removed] = fittedMessages.splice(1, 1);
    estimatedTokens -= estimatePromptMessageTokens(removed);
    droppedMessages += 1;

    if (removed.role === "user") {
      while (fittedMessages.length > 2 && fittedMessages[1].role === "assistant") {
        const [orphanedReply] = fittedMessages.splice(1, 1);
        estimatedTokens -= estimatePromptMessageTokens(orphanedReply);
        droppedMessages += 1;
      }
    }
  }

  return {
    messages: fittedMessages,
    estimatedTokens,
    tokenBudget,
    droppedMessages,
    fixedPromptTooLarge: estimatedTokens > tokenBudget
  };
}
