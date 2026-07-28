import { Prisma } from "@prisma/client";
import { json, parseJson, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { moderateText } from "@/lib/safety";
import { characterUpdateSchema } from "@/lib/validation";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";

type Context = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    let viewer = request.headers.get("authorization") ? await requireMobileUser(request).catch(() => null) : null;
    const character = await prisma.character.findUnique({
      where: { id: (await context.params).id },
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
      viewer ??= await requireMobileUser(request);
      if (character.creatorId !== viewer.id && viewer.role !== "ADMIN") {
        throw new HttpError(404, "Character not found.");
      }
    }

    const canEdit = Boolean(viewer && (character.creatorId === viewer.id || viewer.role === "ADMIN"));
    return json({ character: canEdit ? character : redactCharacterModelSettings(character) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    const character = await prisma.character.findFirst({
      where: {
        id: (await context.params).id,
        ...(user.role === "ADMIN" ? {} : { creatorId: user.id })
      },
      select: {
        creatorId: true,
        name: true,
        description: true,
        personality: true,
        scenario: true,
        greeting: true,
        avatarUrl: true,
        visibility: true,
        persona: true,
        lorebook: true,
        visualIdentity: true,
        systemPromptOverride: true
      }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
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
        input.systemPromptOverride === undefined ? character.systemPromptOverride : input.systemPromptOverride,
        JSON.stringify(input.persona ?? character.persona ?? {}),
        JSON.stringify(input.lorebook ?? character.lorebook ?? {})
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
      where: { id: (await context.params).id },
      data: {
        ...input,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        communicationStyle: input.communicationStyle === undefined ? undefined : input.communicationStyle ?? Prisma.JsonNull,
        persona: input.persona === undefined ? undefined : input.persona ?? Prisma.JsonNull,
        lorebook: input.lorebook === undefined ? undefined : input.lorebook ?? Prisma.JsonNull,
        visualIdentity: input.visualIdentity === undefined ? undefined : input.visualIdentity ?? Prisma.JsonNull,
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
