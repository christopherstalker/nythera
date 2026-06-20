export type EditableMessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export function canEditMessageRole(role: EditableMessageRole) {
  return role === "USER" || role === "ASSISTANT";
}

export function shouldRegenerateAfterMessageEdit(role: EditableMessageRole) {
  return role === "USER";
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
