import { MemoryCategory, Prisma } from "@prisma/client";
import { HttpError, json, parseJson, routeError } from "@/lib/api";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { memoryCreateSchema, memoryUpdateSchema } from "@/lib/validation";
import { createMemory } from "@/lib/vector";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const take = Math.min(Number(searchParams.get("take") ?? 100), 200);

    const memories = await prisma.memory.findMany({
      where: {
        userId: user.id,
        ...(characterId ? { characterId } : {})
      },
      orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
      take,
      select: {
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
      }
    });

    return json({ memories });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const input = await parseJson(request, memoryCreateSchema);
    const providerKeys = await getEffectiveProviderKeys(user.id);

    if (input.characterId) {
      const character = await prisma.character.findFirst({
        where: {
          id: input.characterId,
          OR: [{ visibility: "PUBLIC" }, { visibility: "UNLISTED" }, { creatorId: user.id }]
        },
        select: { id: true }
      });

      if (!character) {
        throw new HttpError(404, "Character not found.");
      }
    }

    const memory = await createMemory({
      userId: user.id,
      characterId: input.characterId ?? null,
      content: input.content,
      category: input.category as MemoryCategory,
      importance: input.importance,
      confidence: 1,
      metadata: { source: "mobile-manual" },
      providerKeys
    });

    if (!memory) {
      throw new HttpError(400, "Memory content did not pass safety checks.");
    }

    if (input.pinned) {
      await prisma.memory.update({
        where: { id: memory.id },
        data: { pinned: true }
      });
    }

    return json({ memory: { ...memory, pinned: input.pinned || memory.pinned } }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new HttpError(400, "id is required.");
    }

    const input = await parseJson(request, memoryUpdateSchema);
    const memory = await prisma.memory.updateMany({
      where: {
        id,
        userId: user.id
      },
      data: {
        content: input.content,
        importance: input.importance,
        pinned: input.pinned,
        category: input.category,
        metadata: input.content
          ? {
              source: "mobile-manual-edit",
              editedAt: new Date().toISOString()
            }
          : undefined
      }
    });

    if (memory.count === 0) {
      throw new HttpError(404, "Memory not found.");
    }

    const updated = await prisma.memory.findUnique({ where: { id } });
    return json({ memory: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return json({ error: "Memory not found." }, { status: 404 });
    }
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      throw new HttpError(400, "id is required.");
    }

    await prisma.memory.deleteMany({
      where: {
        id,
        userId: user.id
      }
    });

    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
