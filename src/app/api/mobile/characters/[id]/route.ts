import { Prisma } from "@prisma/client";
import { json, parseJson, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { characterUpdateSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
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

    if (character.visibility !== "PUBLIC" && character.visibility !== "UNLISTED") {
      const user = await requireMobileUser(request);
      if (character.creatorId !== user.id && user.role !== "ADMIN") {
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
    const user = await requireMobileUser(request);
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
    if (input.isNSFW && !user.ageVerified) {
      throw new HttpError(403, "Confirm age-gated access in profile settings before marking characters as NSFW.");
    }

    const updated = await prisma.character.update({
      where: { id: context.params.id },
      data: {
        ...input,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        communicationStyle: input.communicationStyle === undefined ? undefined : input.communicationStyle ?? Prisma.JsonNull,
        persona: input.persona === undefined ? undefined : input.persona ?? Prisma.JsonNull,
        moderationStatus: input.visibility === "PUBLIC" ? "PENDING" : undefined
      }
    });

    return json({ character: updated });
  } catch (error) {
    return routeError(error);
  }
}
