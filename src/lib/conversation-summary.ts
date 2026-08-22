import type { MessageRole } from "@prisma/client";
import { extractPlayerPhysicalCanon, formatPlayerPhysicalCanon } from "@/lib/physical-continuity";

export function buildConversationSummary(
  messages: Array<{ role: MessageRole; content: string }>,
  previousSummary?: string | null
) {
  const importantLines = messages
    .filter((message) => message.role !== "SYSTEM")
    .map((message) => `${message.role}: ${cleanSummaryLine(message.content).slice(0, 260)}`);
  const physicalCanon = formatPlayerPhysicalCanon(extractPlayerPhysicalCanon([
    previousPlayerPhysicalContext(previousSummary),
    ...messages.filter((message) => message.role === "USER").map((message) => message.content)
  ]));

  if (importantLines.length === 0 && !previousSummary) return null;

  const prior = stripPhysicalCanon(previousSummary?.replace(/^Conversation summary:\n?/, "") ?? "");
  const combined = [prior, ...importantLines].filter(Boolean).join("\n");
  const summaryPrefix = ["Conversation summary:", physicalCanon].filter(Boolean).join("\n");
  if (combined.length <= 8_000 - summaryPrefix.length) {
    return [summaryPrefix, combined].filter(Boolean).join("\n");
  }

  return [
    summaryPrefix,
    combined.slice(0, 3_500),
    "[Earlier middle turns compacted; pinned Memory and Story canon remain authoritative.]",
    combined.slice(-4_300)
  ].join("\n");
}

function previousPlayerPhysicalContext(summary?: string | null) {
  if (!summary) return "";

  const selected: string[] = [];
  let inPhysicalCanon = false;
  for (const line of summary.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "[CANONICAL PLAYER PHYSICAL FACTS]") {
      inPhysicalCanon = true;
      selected.push(trimmed);
      continue;
    }
    if (inPhysicalCanon && !trimmed.startsWith("- ")) inPhysicalCanon = false;
    if (inPhysicalCanon || trimmed.startsWith("USER:")) selected.push(trimmed);
  }
  return selected.join("\n");
}

function stripPhysicalCanon(value: string) {
  return value
    .replace(/^\[CANONICAL PLAYER PHYSICAL FACTS\]\r?\n(?:- .*\r?\n?)*/m, "")
    .trim();
}

function cleanSummaryLine(value: string) {
  return value.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();
}
