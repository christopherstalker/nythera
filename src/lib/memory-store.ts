import "server-only";

import { MemoryCategory, Prisma } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createMemory, writeMemoryEmbedding } from "@/lib/vector";
import type { ProviderKeys } from "@/lib/user-keys";

const memorySelect = {
  id: true,
  characterId: true,
  content: true,
  importance: true,
  category: true,
  confidence: true,
  metadata: true,
  pinned: true,
  sourceChatId: true,
  createdAt: true,
  updatedAt: true,
  character: {
    select: {
      id: true,
      name: true,
      avatarUrl: true
    }
  }
} satisfies Prisma.MemorySelect;

export async function listMemories(input: {
  userId: string;
  characterId?: string | null;
  take?: number;
}) {
  return prisma.memory.findMany({
    where: {
      userId: input.userId,
      ...(input.characterId ? { characterId: input.characterId } : {})
    },
    orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
    take: Math.min(input.take ?? 100, 200),
    select: memorySelect
  });
}

export async function createManualMemory(input: {
  userId: string;
  characterId?: string | null;
  content: string;
  category: MemoryCategory;
  importance: number;
  pinned?: boolean;
  metadataSource: string;
  providerKeys?: ProviderKeys;
}) {
  await assertCharacterReadable(input.userId, input.characterId);

  const memory = await createMemory({
    userId: input.userId,
    characterId: input.characterId ?? null,
    content: input.content,
    category: input.category,
    importance: input.importance,
    confidence: 1,
    metadata: { source: input.metadataSource },
    providerKeys: input.providerKeys
  });

  if (!memory) {
    throw new HttpError(400, "Memory content did not pass safety checks.");
  }

  if (!input.pinned) {
    return memory;
  }

  return prisma.memory.update({
    where: { id: memory.id },
    data: { pinned: true }
  });
}

export async function updateMemory(input: {
  id: string;
  userId: string;
  content?: string;
  importance?: number;
  pinned?: boolean;
  category?: MemoryCategory;
  metadataSource: string;
  providerKeys?: ProviderKeys;
}) {
  const existing = await prisma.memory.findFirst({
    where: {
      id: input.id,
      userId: input.userId
    },
    select: { id: true }
  });

  if (!existing) {
    throw new HttpError(404, "Memory not found.");
  }

  const updated = await prisma.memory.update({
    where: { id: input.id },
    data: {
      content: input.content,
      importance: input.importance,
      pinned: input.pinned,
      category: input.category,
      metadata: input.content
        ? {
            source: input.metadataSource,
            editedAt: new Date().toISOString()
          }
        : undefined
    }
  });

  if (input.content) {
    try {
      await writeMemoryEmbedding(updated.id, updated.content, input.providerKeys);
    } catch (error) {
      console.error("Memory embedding refresh failed.", error);
    }
  }

  return updated;
}

export async function deleteMemory(input: { id: string; userId: string }) {
  await prisma.memory.deleteMany({
    where: {
      id: input.id,
      userId: input.userId
    }
  });
}

async function assertCharacterReadable(userId: string, characterId?: string | null) {
  if (!characterId) {
    return;
  }

  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      OR: [{ visibility: "PUBLIC" }, { visibility: "UNLISTED" }, { creatorId: userId }]
    },
    select: { id: true }
  });

  if (!character) {
    throw new HttpError(404, "Character not found.");
  }
}
