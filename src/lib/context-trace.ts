import type { PromptMessage, RetrievedMemory } from "@/types";
import { parseLorebookEntries } from "@/lib/lorebook";
import { sanitizePromptContext } from "@/lib/prompt-security";

export type ContextEntry = {
  kind: "memory" | "lore" | "summary";
  text: string;
  included: boolean;
  reason: string;
};

export type ContextTrace = {
  version: 1;
  createdAt: string;
  entries: ContextEntry[];
  estimatedTokens: number;
  tokenBudget: number;
  droppedMessages: number;
  semanticEnabled: boolean;
};

export function buildContextTrace(input: {
  prompt: PromptMessage[];
  memories: Pick<RetrievedMemory, "content" | "pinned">[];
  globalMemories: { content: string }[];
  lorebook: unknown;
  summary?: string | null;
  estimatedTokens: number;
  tokenBudget: number;
  droppedMessages: number;
  semanticEnabled: boolean;
}): ContextTrace {
  const system = input.prompt
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const entries: ContextEntry[] = [];
  const seen = new Set<string>();
  for (const memory of [...input.memories, ...input.globalMemories]) {
    const text = sanitizePromptContext(memory.content, 420);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const included = system.includes(text);
    entries.push({
      kind: "memory",
      text,
      included,
      reason: included
        ? "pinned" in memory && memory.pinned
          ? "Pinned fact included in this request"
          : "Retrieved and included in this request"
        : "Retrieved, but excluded by context formatting or selection"
    });
  }
  for (const entry of parseLorebookEntries(input.lorebook)) {
    const text = sanitizePromptContext(entry.text, 700);
    const included = Boolean(text) && system.includes(text);
    entries.push({
      kind: "lore",
      text,
      included,
      reason: included
        ? `Activated lore · ${entry.keywords.join(", ")}`
        : "No keyword match, selection limit, or text transformed during assembly"
    });
  }
  if (input.summary) {
    const text = sanitizePromptContext(input.summary, 8000);
    const included = system.includes(text);
    entries.push({
      kind: "summary",
      text,
      included,
      reason: included ? "Conversation recap included" : "Recent history or selected branch takes precedence"
    });
  }
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    entries,
    estimatedTokens: input.estimatedTokens,
    tokenBudget: input.tokenBudget,
    droppedMessages: input.droppedMessages,
    semanticEnabled: input.semanticEnabled
  };
}
