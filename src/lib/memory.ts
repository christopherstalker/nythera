import "server-only";

import { MemoryCategory, MessageRole, Prisma } from "@prisma/client";
import { enqueueJob } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { createMemory } from "@/lib/vector";
import type { ProviderKeys } from "@/lib/user-keys";

export async function schedulePostMessageJobs(input: {
  chatId: string;
  userId: string;
  characterId: string;
  latestUserMessage: string;
  latestAssistantMessage: string;
  messageCount: number;
  providerKeys?: ProviderKeys;
}) {
  const { providerKeys, ...jobInput } = input;
  const shouldSummarize = input.messageCount > 20 && input.messageCount % 12 === 0;
  const queuedExtraction = await enqueueJob("extract-memories", jobInput);
  const queuedSummary = shouldSummarize ? await enqueueJob("summarize-chat", { chatId: input.chatId }) : false;

  if (!queuedExtraction) {
    await extractMemoriesFromExchange({ ...jobInput, providerKeys });
  }

  if (shouldSummarize && !queuedSummary) {
    await summarizeChat(input.chatId);
  }

  return { queuedExtraction, queuedSummary };
}

export async function extractMemoriesFromExchange(input: {
  chatId: string;
  userId: string;
  characterId: string;
  latestUserMessage: string;
  latestAssistantMessage: string;
  providerKeys?: ProviderKeys;
}) {
  const candidates = extractMemoryCandidates(input.latestUserMessage, input.latestAssistantMessage);
  if (candidates.length === 0) {
    return [];
  }

  return Promise.all(
    candidates.map((candidate) =>
      createMemory({
        userId: input.userId,
        characterId: input.characterId,
        sourceChatId: input.chatId,
        content: candidate.content,
        category: candidate.category,
        metadata: candidate.metadata,
        importance: candidate.importance,
        confidence: candidate.confidence,
        providerKeys: input.providerKeys
      })
    )
  );
}

type MemoryCandidate = {
  content: string;
  category: MemoryCategory;
  importance: number;
  confidence: number;
  metadata: Prisma.InputJsonValue;
};

function extractMemoryCandidates(userMessage: string, assistantMessage: string): MemoryCandidate[] {
  const normalizedUser = cleanSentence(userMessage);
  const normalizedAssistant = cleanSentence(assistantMessage);
  const candidates: MemoryCandidate[] = [];

  addPattern(candidates, normalizedUser, /\bmy name is\s+([^.!?\n]{2,80})/i, MemoryCategory.USER_PROFILE, "User name", 1.6);
  addPattern(candidates, normalizedUser, /\bi(?:'m| am)\s+([^.!?\n]{2,120})/i, MemoryCategory.FACT, "User identity/context", 1.1);
  addPattern(candidates, normalizedUser, /\bi (?:like|love|prefer|enjoy)\s+([^.!?\n]{2,140})/i, MemoryCategory.PREFERENCE, "User preference", 1.4);
  addPattern(candidates, normalizedUser, /\bi (?:hate|dislike|avoid)\s+([^.!?\n]{2,140})/i, MemoryCategory.PREFERENCE, "User aversion", 1.35);
  addPattern(candidates, normalizedUser, /\bi (?:feel|am feeling|felt)\s+([^.!?\n]{2,140})/i, MemoryCategory.EMOTIONAL_CONTEXT, "User emotional context", 1.2);
  addPattern(candidates, normalizedUser, /\bi live in\s+([^.!?\n]{2,120})/i, MemoryCategory.USER_PROFILE, "User location/context", 1.2);
  addPattern(candidates, normalizedUser, /\bremember that\s+([^.!?\n]{2,180})/i, MemoryCategory.FACT, "Explicit memory request", 1.8);

  const topic = recurringTopicCandidate(normalizedUser, normalizedAssistant);
  if (topic) {
    candidates.push(topic);
  }

  return dedupeCandidates(candidates).slice(0, 4);
}

export async function summarizeChat(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 120
      }
    }
  });

  if (!chat) {
    return null;
  }

  const importantLines = chat.messages
    .filter((message) => message.role !== MessageRole.SYSTEM)
    .slice(-40)
    .map((message) => `${message.role}: ${cleanSentence(message.content).slice(0, 260)}`);

  const summary = [
    "Conversation summary:",
    ...importantLines
  ]
    .join("\n")
    .slice(-6000);

  return prisma.chat.update({
    where: { id: chatId },
    data: { summary }
  });
}

function addPattern(
  candidates: MemoryCandidate[],
  message: string,
  pattern: RegExp,
  category: MemoryCategory,
  label: string,
  importance: number
) {
  const match = message.match(pattern);
  const captured = match?.[1]?.trim();
  if (!captured || captured.length < 2) {
    return;
  }

  candidates.push({
    content: `${label}: ${captured}`,
    category,
    importance,
    confidence: 0.82,
    metadata: { extractor: "rule", captured }
  });
}

function recurringTopicCandidate(userMessage: string, assistantMessage: string): MemoryCandidate | null {
  const lower = `${userMessage} ${assistantMessage}`.toLowerCase();
  const topics = [
    "fantasy roleplay",
    "science fiction",
    "cyberpunk",
    "romance",
    "dark academia",
    "slice of life",
    "villain",
    "mentor",
    "worldbuilding",
    "writing",
    "coding",
    "productivity"
  ];
  const topic = topics.find((item) => lower.includes(item));
  if (!topic) {
    return null;
  }

  return {
    content: `Recurring topic: ${topic}`,
    category: MemoryCategory.RECURRING_TOPIC,
    importance: 1,
    confidence: 0.68,
    metadata: { extractor: "topic-keyword", topic }
  };
}

function dedupeCandidates(candidates: MemoryCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.content.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();
}
