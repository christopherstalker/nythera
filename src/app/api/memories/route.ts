import { MemoryCategory } from "@prisma/client";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { memoryCreateSchema, memoryUpdateSchema } from "@/lib/validation";
import { createManualMemory, deleteMemory, listMemories, updateMemory } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const take = Math.min(Number(searchParams.get("take") ?? 100), 200);

    const memories = await listMemories({ userId: user.id, characterId, take });

    return json({ memories });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, memoryCreateSchema);
    const providerKeys = await getEffectiveProviderKeys(user.id);

    const memory = await createManualMemory({
      userId: user.id,
      characterId: input.characterId ?? null,
      content: input.content,
      category: input.category as MemoryCategory,
      importance: input.importance,
      pinned: input.pinned,
      metadataSource: "manual",
      providerKeys
    });

    return json({ memory }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new HttpError(400, "id is required.");
    }

    const input = await parseJson(request, memoryUpdateSchema);
    const providerKeys = input.content ? await getEffectiveProviderKeys(user.id) : undefined;
    const updated = await updateMemory({
      id,
      userId: user.id,
      content: input.content,
      importance: input.importance,
      pinned: input.pinned,
      category: input.category as MemoryCategory | undefined,
      metadataSource: "manual-edit",
      providerKeys
    });
    return json({ memory: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      throw new HttpError(400, "id is required.");
    }

    await deleteMemory({ id, userId: user.id });

    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
