export type EditableMessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export function canEditMessageRole(role: EditableMessageRole) {
  return role === "USER" || role === "ASSISTANT";
}

export function shouldRegenerateAfterMessageEdit(role: EditableMessageRole) {
  return role === "USER";
}

type RegenerationMessage = {
  id: string;
  role: EditableMessageRole;
  content: string;
};

export type RegenerationTurn<T extends RegenerationMessage = RegenerationMessage> = {
  currentMessage: string;
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
      ? { currentMessage: lastMessage.content, recentMessages: messages.slice(0, -1) }
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
  while (firstVariantIndex > 0 && messages[firstVariantIndex - 1].role === "ASSISTANT") {
    firstVariantIndex -= 1;
  }

  const latestVariants = messages.slice(firstVariantIndex, latestAssistantIndex + 1);
  if (!latestVariants.some((message) => message.id === targetAssistantId)) {
    return null;
  }

  const userMessageIndex = firstVariantIndex - 1;
  const userMessage = messages[userMessageIndex];
  if (!userMessage || userMessage.role !== "USER") {
    return null;
  }

  return {
    currentMessage: userMessage.content,
    recentMessages: messages.slice(0, userMessageIndex)
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
