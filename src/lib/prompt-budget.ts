import { modelContextWindow } from "@/lib/provider-model-options";

const TOKEN_SAFETY_MARGIN = 1_024;
const FIXED_PROMPT_RESERVE = 4_000;

export function estimatePromptTokens(value: string) {
  return Math.ceil(value.length / 4);
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
  return Math.max(512, modelContextWindow(input.model) - usedOutsideHistory);
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
