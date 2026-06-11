import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { characterUpdateSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
  try {
    const character = await prisma.character.findUnique({
      where: { id: context.params.id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            image: true
          }
        }
      }
    });

    if (!character || character.blockedAt) {
      throw new HttpError(404, "Character not found.");
    }

    if (character.visibility !== "PUBLIC") {
      const user = await requireUser();
      if (character.creatorId !== user.id && user.role !== "ADMIN" && character.visibility !== "UNLISTED") {
        throw new HttpError(404, "Character not found.");
      }
    }

    return json({ character });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const character = await prisma.character.findUnique({
      where: { id: context.params.id },
      select: { creatorId: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
    }

    if (character.creatorId !== user.id && user.role !== "ADMIN") {
      throw new HttpError(403, "You cannot edit this character.");
    }

    const input = await parseJson(request, characterUpdateSchema);
    const updated = await prisma.character.update({
      where: { id: context.params.id },
      data: {
        ...input,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        communicationStyle: input.communicationStyle === undefined ? undefined : input.communicationStyle ?? Prisma.JsonNull,
        moderationStatus: input.visibility === "PUBLIC" ? "PENDING" : undefined
      }
    });

    return json({ character: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const character = await prisma.character.findUnique({
      where: { id: context.params.id },
      select: { creatorId: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
    }

    if (character.creatorId !== user.id && user.role !== "ADMIN") {
      throw new HttpError(403, "You cannot delete this character.");
    }

    await prisma.character.delete({ where: { id: context.params.id } });
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const source = await prisma.character.findUnique({
      where: { id: context.params.id }
    });

    if (!source || source.visibility !== "PUBLIC" || source.blockedAt) {
      throw new HttpError(404, "Public character not found.");
    }

    const clone = await prisma.character.create({
      data: {
        creatorId: user.id,
        cloneSourceId: source.id,
        name: `${source.name} remix`,
        avatarUrl: source.avatarUrl,
        description: source.description,
        personality: source.personality,
        scenario: source.scenario,
        greeting: source.greeting,
        communicationStyle: source.communicationStyle ?? Prisma.JsonNull,
        visibility: "PRIVATE",
        moderationStatus: "APPROVED",
        tags: source.tags,
        isNSFW: source.isNSFW
      }
    });

    return json({ character: clone }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
