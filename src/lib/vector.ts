import "server-only";

import { MemoryCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizePromptContext, shouldStoreMemoryFromText } from "@/lib/prompt-security";
import { createEmbedding } from "@/lib/proxy";
import { logSafeError } from "@/lib/secret-redaction";
import type { ProviderKeys } from "@/lib/user-keys";
import type { RetrievedMemory } from "@/types";

export async function searchMemories(input: {
  userId: string;
  characterId?: string | null;
  query: string;
  limit?: number;
  providerKeys?: ProviderKeys;
}): Promise<RetrievedMemory[]> {
  const embedding = await createEmbedding(input.query, input.providerKeys);
  const vector = toVectorLiteral(embedding);
  const limit = input.limit ?? 5;

  try {
    return await prisma.$queryRaw<RetrievedMemory[]>`
        SELECT id, content, importance, category, confidence, metadata, 1 - (embedding <=> ${vector}::vector) AS similarity
        FROM "Memory"
        WHERE "userId" = ${input.userId}
          AND embedding IS NOT NULL
          AND ("characterId" = ${input.characterId ?? null} OR "characterId" IS NULL)
          AND (1 - (embedding <=> ${vector}::vector)) >= 0.18
        ORDER BY embedding <=> ${vector}::vector, importance DESC
        LIMIT ${limit}
      `;
  } catch (error) {
    logSafeError("Vector search failed.", error);
    return [];
  }
}

export async function createMemory(input: {
  userId: string;
  characterId?: string | null;
  sourceChatId?: string | null;
  content: string;
  category?: MemoryCategory;
  metadata?: Prisma.InputJsonValue;
  importance?: number;
  confidence?: number;
  providerKeys?: ProviderKeys;
}) {
  const content = sanitizePromptContext(input.content, 1000);
  if (!content || !shouldStoreMemoryFromText(content)) {
    console.warn("Unsafe memory content rejected.");
    return null;
  }

  const existing = await prisma.memory.findFirst({
    where: {
      userId: input.userId,
      characterId: input.characterId ?? null,
      content
    }
  });

  if (existing) {
    return existing;
  }

  const memory = await prisma.memory.create({
    data: {
      userId: input.userId,
      characterId: input.characterId,
      sourceChatId: input.sourceChatId,
      content,
      category: input.category ?? MemoryCategory.OTHER,
      metadata: input.metadata ?? Prisma.JsonNull,
      importance: input.importance ?? 1,
      confidence: input.confidence ?? 0.75
    }
  });

  try {
    await writeMemoryEmbedding(memory.id, content, input.providerKeys);
  } catch (error) {
    logSafeError("Memory embedding write failed.", error);
  }

  return memory;
}

export async function writeMemoryEmbedding(memoryId: string, content: string, providerKeys?: ProviderKeys) {
  const embedding = await createEmbedding(content, providerKeys);
  await prisma.$executeRaw`UPDATE "Memory" SET embedding = ${toVectorLiteral(embedding)}::vector WHERE id = ${memoryId}`;
}

export function toVectorLiteral(vector: number[]) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
