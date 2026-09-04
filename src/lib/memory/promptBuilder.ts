import "server-only";

import { MemoryCategory, MemoryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPromptMemories } from "@/lib/memory-store";
import type { ProviderKeys } from "@/lib/user-keys";
import type { RetrievedMemory } from "@/types";
import type { TieredMemoryView } from "@/lib/memory/types";

const USER_GLOBAL_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.USER_PROFILE,
  MemoryCategory.PREFERENCE,
  MemoryCategory.FACT
];

export async function getUserMemories(userId: string, limit = 12) {
  return prisma.memory.findMany({
    where: {
      userId,
      characterId: null,
      status: MemoryStatus.ACTIVE
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: { content: true, category: true, metadata: true }
  });
}

export async function getCharacterMemoriesForPrompt(input: {
  userId: string;
  characterId: string;
  query: string;
  limit?: number;
  providerKeys?: ProviderKeys;
}) {
  return getPromptMemories({
    userId: input.userId,
    characterId: input.characterId,
    query: input.query,
    totalLimit: input.limit ?? 5,
    providerKeys: input.providerKeys,
    includeGlobal: false
  });
}

export function splitMemoriesForPrompt(memories: RetrievedMemory[], userGlobal: Array<{ content: string; category: MemoryCategory; metadata?: unknown }>): TieredMemoryView {
  return {
    character: memories.map((memory) => ({ text: memory.content, category: memory.category as MemoryCategory })),
    user: userGlobal
      .filter((memory) => USER_GLOBAL_CATEGORIES.includes(memory.category))
      .map((memory) => ({ text: memory.content, category: memory.category, metadata: memory.metadata }))
  };
}

export function formatTieredMemoryBlocks(view: TieredMemoryView) {
  const characterMemories = view.character.slice(0, 5).map((memory) => memory.text);
  const userMemories = view.user.map((memory) => `${memoryLabel(memory)}: ${memory.text}`);
  return { characterMemories, userMemories };
}

function memoryLabel(memory: TieredMemoryView["user"][number]) {
  const metadata = memory.metadata && typeof memory.metadata === "object" && !Array.isArray(memory.metadata)
    ? memory.metadata as Record<string, unknown>
    : null;
  const extractedCategory = typeof metadata?.category === "string" ? metadata.category : "";
  if (extractedCategory === "identity" || memory.category === MemoryCategory.USER_PROFILE) return "Identity";
  if (extractedCategory === "style") return "Style";
  if (extractedCategory === "avoid") return "Avoid";
  if (memory.category === MemoryCategory.PREFERENCE) return "Preference";
  return "Fact";
}
