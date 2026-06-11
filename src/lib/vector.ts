import "server-only";

import { prisma } from "@/lib/prisma";
import { createEmbedding } from "@/lib/proxy";
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
    return await prisma.$queryRawUnsafe<RetrievedMemory[]>(
      `
        SELECT id, content, importance, category, 1 - (embedding <=> $1::vector) AS similarity
        FROM "Memory"
        WHERE "userId" = $2
          AND embedding IS NOT NULL
          AND ("characterId" = $3 OR "characterId" IS NULL)
        ORDER BY embedding <=> $1::vector, importance DESC
        LIMIT $4
      `,
      vector,
      input.userId,
      input.characterId ?? null,
      limit
    );
  } catch (error) {
    console.error("Vector search failed.", error);
    return [];
  }
}

export async function createMemory(input: {
  userId: string;
  characterId?: string | null;
  sourceChatId?: string | null;
  content: string;
  importance?: number;
}) {
  const memory = await prisma.memory.create({
    data: {
      userId: input.userId,
      characterId: input.characterId,
      sourceChatId: input.sourceChatId,
      content: input.content,
      importance: input.importance ?? 1
    }
  });

  try {
    const embedding = await createEmbedding(input.content);
    await prisma.$executeRawUnsafe(
      `UPDATE "Memory" SET embedding = $1::vector WHERE id = $2`,
      toVectorLiteral(embedding),
      memory.id
    );
  } catch (error) {
    console.error("Memory embedding write failed.", error);
  }

  return memory;
}

export function toVectorLiteral(vector: number[]) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
