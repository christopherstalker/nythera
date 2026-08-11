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
    !messages[firstVariantIndex].clientRequestId?.startsWith("continue-") &&
    messages[firstVariantIndex - 1].role === "ASSISTANT"
  ) {
    firstVariantIndex -= 1;
  }

  return messages.slice(firstVariantIndex, latestAssistantIndex + 1);
}

const CONTINUATION_BRANCH_MARKER = "::branch=";

export function continuationClientRequestId(requestId: string, sourceMessageId: string) {
  return `continue-${requestId}${CONTINUATION_BRANCH_MARKER}${sourceMessageId}`;
}

export function continuationSourceMessageId(clientRequestId?: string | null) {
  if (!clientRequestId?.startsWith("continue-")) return null;
  const markerIndex = clientRequestId.lastIndexOf(CONTINUATION_BRANCH_MARKER);
  return markerIndex < 0 ? null : clientRequestId.slice(markerIndex + CONTINUATION_BRANCH_MARKER.length) || null;
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
          !selected[groupStart].clientRequestId?.startsWith("continue-") &&
          selected[groupStart - 1].role === "ASSISTANT"
        ) {
          groupStart -= 1;
        }

        let groupEnd = sourceIndex;
        while (
          groupEnd + 1 < selected.length &&
          selected[groupEnd + 1].role === "ASSISTANT" &&
          !selected[groupEnd + 1].clientRequestId?.startsWith("continue-")
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
  trigger: "user" | "continuation" | "opening";
  currentMessage?: string;
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
    !messages[firstVariantIndex].clientRequestId?.startsWith("continue-") &&
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
    !messages[firstVariantIndex].clientRequestId?.startsWith("continue-") &&
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

  return {
    trigger: messages[firstVariantIndex].clientRequestId?.startsWith("continue-") ? "continuation" : "opening",
    recentMessages: messages.slice(0, firstVariantIndex)
  };
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
