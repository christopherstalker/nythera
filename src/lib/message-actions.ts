import type { SkipTimeDuration, SkipTimeUnit } from "@/lib/chat-actions";

export type EditableMessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export function canEditMessageRole(role: EditableMessageRole) {
  return role === "USER" || role === "ASSISTANT";
}

export function shouldRegenerateAfterMessageEdit(role: EditableMessageRole) {
  return role === "USER";
}

export function resolveVariantSelection(
  currentIndex: number | undefined,
  previousVariantCount: number | undefined,
  variantCount: number,
  persistedIndex?: number
) {
  const latestIndex = Math.max(0, variantCount - 1);
  const receivedNewVariant = previousVariantCount !== undefined && variantCount > previousVariantCount;

  if (persistedIndex !== undefined && persistedIndex >= 0 && persistedIndex < variantCount && !receivedNewVariant) {
    return persistedIndex;
  }

  if (
    currentIndex === undefined ||
    currentIndex < 0 ||
    currentIndex >= variantCount ||
    receivedNewVariant
  ) {
    return latestIndex;
  }

  return currentIndex;
}

type RegenerationMessage = {
  id: string;
  role: EditableMessageRole;
  content: string;
  clientRequestId?: string | null;
  branchSourceMessageId?: string | null;
};

export function latestAssistantVariantGroup<T extends RegenerationMessage>(messages: T[]) {
  let latestAssistantIndex = messages.length - 1;
  while (latestAssistantIndex >= 0 && messages[latestAssistantIndex].role !== "ASSISTANT") {
    latestAssistantIndex -= 1;
  }

  if (latestAssistantIndex < 0) {
    return [] as T[];
  }

  let firstVariantIndex = latestAssistantIndex;
  while (
    firstVariantIndex > 0 &&
    !assistantActionKind(messages[firstVariantIndex].clientRequestId) &&
    messages[firstVariantIndex - 1].role === "ASSISTANT"
  ) {
    firstVariantIndex -= 1;
  }

  return messages.slice(firstVariantIndex, latestAssistantIndex + 1);
}

const CONTINUATION_BRANCH_MARKER = "::branch=";
const SKIP_TIME_DURATION_MARKER = "::duration=";
const CONTINUATION_REQUEST_PREFIX = "continue-";
const SKIP_TIME_REQUEST_PREFIX = "skip-time-";

export type AssistantActionKind = "continuation" | "skip-time";

export function continuationClientRequestId(requestId: string, sourceMessageId: string) {
  return `${CONTINUATION_REQUEST_PREFIX}${requestId}${CONTINUATION_BRANCH_MARKER}${sourceMessageId}`;
}

export function skipTimeClientRequestId(requestId: string, sourceMessageId?: string | null, duration?: SkipTimeDuration | null) {
  const durationMarker = duration ? `${SKIP_TIME_DURATION_MARKER}${duration.value}:${duration.unit}` : "";
  return `${SKIP_TIME_REQUEST_PREFIX}${requestId}${durationMarker}${sourceMessageId ? `${CONTINUATION_BRANCH_MARKER}${sourceMessageId}` : ""}`;
}

export function assistantActionKind(clientRequestId?: string | null): AssistantActionKind | null {
  if (clientRequestId?.startsWith(SKIP_TIME_REQUEST_PREFIX)) return "skip-time";
  if (clientRequestId?.startsWith(CONTINUATION_REQUEST_PREFIX)) return "continuation";
  return null;
}

export function continuationSourceMessageId(clientRequestId?: string | null) {
  if (!clientRequestId || !assistantActionKind(clientRequestId)) return null;
  const markerIndex = clientRequestId.lastIndexOf(CONTINUATION_BRANCH_MARKER);
  return markerIndex < 0 ? null : clientRequestId.slice(markerIndex + CONTINUATION_BRANCH_MARKER.length) || null;
}

export function skipTimeDurationFromClientRequestId(clientRequestId?: string | null): SkipTimeDuration | null {
  if (!clientRequestId?.startsWith(SKIP_TIME_REQUEST_PREFIX)) return null;
  const markerIndex = clientRequestId.indexOf(SKIP_TIME_DURATION_MARKER);
  if (markerIndex < 0) return null;

  const encoded = clientRequestId
    .slice(markerIndex + SKIP_TIME_DURATION_MARKER.length)
    .split(CONTINUATION_BRANCH_MARKER, 1)[0];
  const [rawValue, rawUnit] = encoded.split(":", 2);
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || !isSkipTimeUnit(rawUnit)) return null;
  return { value, unit: rawUnit };
}

export function branchSourceMessageId(message: Pick<RegenerationMessage, "branchSourceMessageId" | "clientRequestId">) {
  return message.branchSourceMessageId ?? continuationSourceMessageId(message.clientRequestId);
}

export function selectPersistedConversationBranch<T extends RegenerationMessage>(messages: T[]) {
  const selected: T[] = [];

  for (const message of messages) {
    const sourceMessageId = branchSourceMessageId(message);
    if (sourceMessageId) {
      const sourceIndex = selected.findIndex((candidate) => candidate.id === sourceMessageId);
      if (sourceIndex >= 0) {
        let groupStart = sourceIndex;
        while (
          groupStart > 0 &&
          !assistantActionKind(selected[groupStart].clientRequestId) &&
          selected[groupStart - 1].role === "ASSISTANT"
        ) {
          groupStart -= 1;
        }

        let groupEnd = sourceIndex;
        while (
          groupEnd + 1 < selected.length &&
          selected[groupEnd + 1].role === "ASSISTANT" &&
          !assistantActionKind(selected[groupEnd + 1].clientRequestId)
        ) {
          groupEnd += 1;
        }

        selected.splice(groupStart, groupEnd - groupStart + 1, selected[sourceIndex]);
      }
    }
    selected.push(message);
  }

  return selected;
}

export type RegenerationTurn<T extends RegenerationMessage = RegenerationMessage> = {
  trigger: "user" | AssistantActionKind | "opening";
  currentMessage?: string;
  skipTimeDuration?: SkipTimeDuration | null;
  recentMessages: T[];
};

export function prepareUserRetryTurn<T extends RegenerationMessage>(
  messages: T[],
  targetUserId: string
): RegenerationTurn<T> | null {
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "USER" || lastMessage.id !== targetUserId) {
    return null;
  }

  return {
    trigger: "user",
    currentMessage: lastMessage.content,
    recentMessages: messages.slice(0, -1)
  };
}

export function prepareContinuationTurn<T extends RegenerationMessage>(
  messages: T[],
  targetAssistantId?: string
) {
  if (!targetAssistantId) {
    return messages;
  }

  let latestAssistantIndex = messages.length - 1;
  while (latestAssistantIndex >= 0 && messages[latestAssistantIndex].role !== "ASSISTANT") {
    latestAssistantIndex -= 1;
  }
  if (latestAssistantIndex < 0) {
    return null;
  }

  let firstVariantIndex = latestAssistantIndex;
  while (
    firstVariantIndex > 0 &&
    !assistantActionKind(messages[firstVariantIndex].clientRequestId) &&
    messages[firstVariantIndex - 1].role === "ASSISTANT"
  ) {
    firstVariantIndex -= 1;
  }

  const latestVariants = messages.slice(firstVariantIndex, latestAssistantIndex + 1);
  const selected = latestVariants.find((message) => message.id === targetAssistantId);
  if (!selected) {
    return null;
  }

  return [...messages.slice(0, firstVariantIndex), selected];
}

export function conversationBranchThroughMessage<T extends RegenerationMessage>(
  messages: T[],
  targetMessageId: string
) {
  const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
  if (targetIndex < 0) return null;

  const prefix = messages.slice(0, targetIndex + 1);
  const target = prefix.at(-1);
  if (!target) return null;

  if (target.role !== "ASSISTANT") {
    return selectPersistedConversationBranch(prefix);
  }

  const selectedVariantPrefix = prepareContinuationTurn(prefix, target.id);
  return selectedVariantPrefix
    ? selectPersistedConversationBranch(selectedVariantPrefix)
    : null;
}

export function prepareRegenerationTurn<T extends RegenerationMessage>(
  messages: T[],
  targetAssistantId?: string
): RegenerationTurn<T> | null {
  if (messages.length === 0) {
    return null;
  }

  if (!targetAssistantId) {
    const lastMessage = messages[messages.length - 1];
    return lastMessage.role === "USER"
      ? { trigger: "user", currentMessage: lastMessage.content, recentMessages: messages.slice(0, -1) }
      : null;
  }

  let latestAssistantIndex = messages.length - 1;
  while (latestAssistantIndex >= 0 && messages[latestAssistantIndex].role !== "ASSISTANT") {
    latestAssistantIndex -= 1;
  }

  if (latestAssistantIndex < 0) {
    return null;
  }

  let firstVariantIndex = latestAssistantIndex;
  while (
    firstVariantIndex > 0 &&
    !assistantActionKind(messages[firstVariantIndex].clientRequestId) &&
    messages[firstVariantIndex - 1].role === "ASSISTANT"
  ) {
    firstVariantIndex -= 1;
  }

  const latestVariants = messages.slice(firstVariantIndex, latestAssistantIndex + 1);
  if (!latestVariants.some((message) => message.id === targetAssistantId)) {
    return null;
  }

  const userMessageIndex = firstVariantIndex - 1;
  const userMessage = messages[userMessageIndex];
  if (userMessage?.role === "USER") {
    return {
      trigger: "user",
      currentMessage: userMessage.content,
      recentMessages: messages.slice(0, userMessageIndex)
    };
  }

  const trigger = assistantActionKind(messages[firstVariantIndex].clientRequestId) ?? "opening";
  return {
    trigger,
    skipTimeDuration: trigger === "skip-time"
      ? skipTimeDurationFromClientRequestId(messages[firstVariantIndex].clientRequestId)
      : null,
    recentMessages: messages.slice(0, firstVariantIndex)
  };
}

function isSkipTimeUnit(value?: string): value is SkipTimeUnit {
  return value === "minute" || value === "hour" || value === "day" || value === "week" || value === "month" || value === "year";
}

export function partitionMessagesForRewind<T extends { id: string }>(messages: T[], messageId: string) {
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0) {
    return { retained: messages, removed: [] as T[] };
  }

  return {
    retained: messages.slice(0, index + 1),
    removed: messages.slice(index + 1)
  };
}
