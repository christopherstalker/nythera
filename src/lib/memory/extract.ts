import "server-only";

import { MemoryCategory, MemoryStatus } from "@prisma/client";
import { streamGatewayResponse } from "@/lib/llm-gateway";
import type { ProviderKeys } from "@/lib/user-keys";
import type { ExtractedMemory } from "@/lib/memory/types";
import { createMemory } from "@/lib/vector";
import { sanitizePromptContext, shouldStoreMemoryFromText } from "@/lib/prompt-security";
import { z } from "zod";

const extractionSchemaHint = `[{"text":"...","tier":"character|user","category":"preference|identity|style|avoid|relationship|event|promise|state"}]`;
const extractedMemoriesSchema = z.array(z.object({
  text: z.string().min(2).max(500),
  tier: z.enum(["character", "user"]),
  category: z.enum(["preference", "identity", "style", "avoid", "relationship", "event", "promise", "state"])
})).max(6);

export async function extractMemoriesWithLlm(input: {
  userId: string;
  characterId: string;
  chatId: string;
  sourceMessageId: string;
  userMessage: string;
  assistantMessage: string;
  providerKeys?: ProviderKeys;
}) {
  if (!input.providerKeys?.length) {
    return [];
  }

  const prompt = [
    "Review this conversation turn. Extract ONLY facts that should be remembered for future chats.",
    "Focus on durable user preferences and identity, relationship developments, promises, secrets, injuries, named people, important objects, goals, locations, and state changes that affect future scenes.",
    "Write each memory as a self-contained fact with explicit subjects. Never use vague pronouns whose referent will be unclear later.",
    `Return as JSON array: ${extractionSchemaHint}`,
    "If nothing memorable, return [].",
    "",
    `<user-turn>${sanitizePromptContext(input.userMessage, 3000)}</user-turn>`,
    `<assistant-turn>${sanitizePromptContext(input.assistantMessage, 4000)}</assistant-turn>`
  ].join("\n");

  let raw = "";
  for await (const chunk of streamGatewayResponse({
    messages: [
      { role: "system", content: "Return ONLY valid JSON. No markdown." },
      { role: "user", content: prompt }
    ],
    model: extractionModel(input.providerKeys),
    temperature: 0.2,
    userId: input.userId,
    chatId: input.chatId,
    providerKeys: input.providerKeys
  })) {
    if (chunk.type === "delta") raw += chunk.text;
    if (chunk.type === "error") return [];
  }

  let parsed: ExtractedMemory[] = [];
  try {
    parsed = extractedMemoriesSchema.parse(JSON.parse(extractJson(raw)));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const stored = [];
  for (const item of parsed.slice(0, 6)) {
    const text = item.text?.trim();
    if (!text || !shouldStoreMemoryFromText(text)) continue;

    const memory = await createMemory({
      userId: input.userId,
      characterId: item.tier === "user" ? null : input.characterId,
      sourceChatId: input.chatId,
      sourceMessageId: input.sourceMessageId,
      content: text,
      category: mapCategory(item.category),
      importance: item.tier === "character" ? 1.35 : 1.2,
      confidence: 0.78,
      status: MemoryStatus.ACTIVE,
      metadata: { extractor: "llm", tier: item.tier, category: item.category },
      providerKeys: input.providerKeys
    });
    if (memory) stored.push(memory);
  }

  return stored;
}

function extractionModel(providerKeys: ProviderKeys) {
  const primary = providerKeys[0];
  if (!primary) return "gpt-4o-mini";
  return primary.provider === "openai" ? "gpt-4o-mini" : primary.defaultModel || "gpt-4o-mini";
}

function mapCategory(category: ExtractedMemory["category"]): MemoryCategory {
  switch (category) {
    case "preference":
    case "style":
    case "avoid":
      return MemoryCategory.PREFERENCE;
    case "identity":
      return MemoryCategory.USER_PROFILE;
    case "relationship":
      return MemoryCategory.EMOTIONAL_CONTEXT;
    case "event":
    case "promise":
      return MemoryCategory.EVENT;
    case "state":
      return MemoryCategory.FACT;
    default:
      return MemoryCategory.FACT;
  }
}

function extractJson(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) return "[]";
  return raw.slice(start, end + 1);
}
