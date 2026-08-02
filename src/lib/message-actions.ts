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
  variantCount: number
) {
  const latestIndex = Math.max(0, variantCount - 1);
  const receivedNewVariant = previousVariantCount !== undefined && variantCount > previousVariantCount;

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
};

export type RegenerationTurn<T extends RegenerationMessage = RegenerationMessage> = {
  trigger: "user" | "continuation" | "opening";
  currentMessage?: string;
  recentMessages: T[];
};

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
