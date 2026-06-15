import { Prisma } from "@prisma/client";
import { json, parseJson, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { moderateText } from "@/lib/safety";
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

    const isApprovedPublic = character.visibility === "PUBLIC" && character.moderationStatus === "APPROVED";
    const isApprovedUnlisted = character.visibility === "UNLISTED" && character.moderationStatus === "APPROVED";

    if (!isApprovedPublic && !isApprovedUnlisted) {
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
      select: {
        creatorId: true,
        name: true,
        description: true,
        personality: true,
        scenario: true,
        greeting: true,
        avatarUrl: true,
        visibility: true,
        persona: true
      }
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

    const nextVisibility = input.visibility ?? character.visibility;
    const nextAvatarUrl = input.avatarUrl === undefined ? character.avatarUrl : input.avatarUrl;
    if (nextVisibility === "PUBLIC" && !nextAvatarUrl?.trim()) {
      throw new HttpError(400, "Add an avatar before publishing a character publicly.");
    }

    const moderation = moderateText({
      text: [
        input.name ?? character.name,
        input.description ?? character.description,
        input.personality ?? character.personality,
        input.scenario ?? character.scenario,
        input.greeting ?? character.greeting,
        JSON.stringify(input.persona ?? character.persona ?? {})
      ]
        .filter(Boolean)
        .join("\n"),
      userIsMinor: isMinor(user.birthDate),
      context: "character"
    });

    if (!moderation.allowed) {
      throw new HttpError(400, moderation.reason ?? "Character content did not pass moderation.");
    }

    const updated = await prisma.character.update({
      where: { id: context.params.id },
      data: {
        ...input,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        communicationStyle: input.communicationStyle === undefined ? undefined : input.communicationStyle ?? Prisma.JsonNull,
        persona: input.persona === undefined ? undefined : input.persona ?? Prisma.JsonNull,
        // Mobile edits follow the same public visibility contract as the web app.
        moderationStatus: "APPROVED"
      }
    });

    return json({ character: updated });
  } catch (error) {
    return routeError(error);
  }
}

function isMinor(birthDate: Date | null) {
  if (!birthDate) {
    return false;
  }

  return Date.now() - birthDate.getTime() < 18 * 365.25 * 24 * 60 * 60 * 1000;
}
