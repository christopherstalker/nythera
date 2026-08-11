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
  includeGlobal?: boolean;
}): Promise<RetrievedMemory[]> {
  const embedding = await createEmbedding(input.query, input.providerKeys);
  const vector = toVectorLiteral(embedding);
  const limit = input.limit ?? 5;
  const includeGlobal = input.includeGlobal ?? true;

  try {
    return await prisma.$queryRaw<RetrievedMemory[]>`
        SELECT id, content, importance, category, confidence, metadata, pinned, 1 - (embedding <=> ${vector}::vector) AS similarity
        FROM "Memory"
        WHERE "userId" = ${input.userId}
          AND embedding IS NOT NULL
          AND ("characterId" = ${input.characterId ?? null} OR (${includeGlobal} AND "characterId" IS NULL))
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
  sourceMessageId?: string | null;
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

  let embedding: number[] | null = null;
  try {
    embedding = await createEmbedding(content, input.providerKeys);
    const vector = toVectorLiteral(embedding);
    const duplicate = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Memory"
      WHERE "userId" = ${input.userId}
        AND "characterId" IS NOT DISTINCT FROM ${input.characterId ?? null}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vector}::vector) > 0.92
      ORDER BY embedding <=> ${vector}::vector
      LIMIT 1
    `;
    if (duplicate[0]) {
      return prisma.memory.findUnique({ where: { id: duplicate[0].id } });
    }
  } catch (error) {
    logSafeError("Memory semantic deduplication failed.", error);
  }

  let memory;
  try {
    memory = await prisma.memory.create({
      data: {
        userId: input.userId,
        characterId: input.characterId,
        sourceChatId: input.sourceChatId,
        sourceMessageId: input.sourceMessageId,
        content,
        category: input.category ?? MemoryCategory.OTHER,
        metadata: input.metadata ?? Prisma.JsonNull,
        importance: input.importance ?? 1,
        confidence: input.confidence ?? 0.75
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003" && input.sourceMessageId) {
      return null;
    }
    throw error;
  }

  try {
    if (embedding) {
      await prisma.$executeRaw`UPDATE "Memory" SET embedding = ${toVectorLiteral(embedding)}::vector WHERE id = ${memory.id}`;
    } else {
      await writeMemoryEmbedding(memory.id, content, input.providerKeys);
    }
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
