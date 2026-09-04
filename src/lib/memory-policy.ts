const SUMMARY_START_MESSAGE_COUNT = 33;
const SUMMARY_RECENT_MESSAGE_RESERVE = 24;
const SUMMARY_REFRESH_TURNS = 3;
const SUMMARY_READ_REPAIR_LAG = 6;
const MEMORY_QUERY_MESSAGE_LIMIT = 8;
const MEMORY_QUERY_CHARACTER_LIMIT = 4_000;

export function completedConversationTurns(messageCount: number) {
  return Math.max(0, Math.floor(messageCount / 2));
}

export function shouldCaptureContext(messageCount: number) {
  const turns = completedConversationTurns(messageCount);
  return turns > 0 && turns % 3 === 0;
}

export function shouldRunDeepMemoryExtraction(messageCount: number) {
  const turns = completedConversationTurns(messageCount);
  return turns > 0 && turns % 6 === 0;
}

export function shouldRefreshConversationSummary(messageCount: number) {
  const turns = completedConversationTurns(messageCount);
  return messageCount >= SUMMARY_START_MESSAGE_COUNT && turns % SUMMARY_REFRESH_TURNS === 0;
}

export function conversationSummaryIsStale(input: {
  messageCount: number;
  summaryThroughSequence: number;
}) {
  const requiredSequence = Math.max(0, input.messageCount - SUMMARY_RECENT_MESSAGE_RESERVE);
  const missingSequences = requiredSequence - input.summaryThroughSequence;
  return input.messageCount >= SUMMARY_START_MESSAGE_COUNT && missingSequences >= SUMMARY_READ_REPAIR_LAG;
}

export function buildMemoryRetrievalQuery(
  currentMessage: string,
  recentMessages: Array<{ role?: string; content: string }>
) {
  const parts = [
    currentMessage,
    ...recentMessages
      .filter((message) => message.role !== "SYSTEM")
      .slice(-MEMORY_QUERY_MESSAGE_LIMIT)
      .reverse()
      .map((message) => message.content)
  ];
  const seen = new Set<string>();
  const selected: string[] = [];
  let length = 0;

  for (const part of parts) {
    const normalized = part.replace(/\s+/g, " ").trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;

    const available = MEMORY_QUERY_CHARACTER_LIMIT - length;
    if (available <= 0) break;
    selected.push(normalized.slice(0, available));
    seen.add(key);
    length += Math.min(normalized.length, available) + 1;
  }

  return selected.join("\n");
}
