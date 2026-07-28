import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText } from "@/lib/safety";
import { characterUpdateSchema } from "@/lib/validation";
import { normalizeCharacterTags } from "@/lib/character-tags";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const session = await auth();
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

    if (!isApprovedPublic) {
      const user = await requireUser();
      if (character.creatorId !== user.id && user.role !== "ADMIN" && !isApprovedUnlisted) {
        throw new HttpError(404, "Character not found.");
      }
    }

    const [liked, myRating, recentChat] = session?.user?.id
      ? await Promise.all([
          prisma.characterLike.findUnique({
            where: {
              userId_characterId: {
                userId: session.user.id,
                characterId: character.id
              }
            },
            select: { userId: true }
          }),
          prisma.characterRating.findUnique({
            where: {
              userId_characterId: {
                userId: session.user.id,
                characterId: character.id
              }
            }
          }),
          prisma.chat.findFirst({
            where: {
              userId: session.user.id,
              characterId: character.id,
              archivedAt: null
            },
            orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
            select: { id: true }
          })
        ])
      : [null, null, null];

    const canEdit = Boolean(session?.user?.id && session.user.id === character.creatorId);
    return json({
      character: canEdit ? character : redactCharacterModelSettings(character),
      recentChat,
      viewer: {
        canEdit,
        liked: Boolean(liked),
        rating: myRating
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const character = await prisma.character.findFirst({
      where: {
        id: (await context.params).id,
        ...(user.role === "ADMIN" ? {} : { creatorId: user.id })
      },
      select: {
        creatorId: true,
        creationMode: true,
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
    if (input.creationMode && input.creationMode !== character.creationMode) {
      throw new HttpError(400, "A character cannot be converted between Simple and Custom modes.");
    }
    if (input.isNSFW && !user.ageVerified) {
      throw new HttpError(403, "Confirm age-gated access in profile settings before marking characters as NSFW.");
    }

    const nextVisibility = input.visibility ?? character.visibility;
    const nextAvatarUrl = input.avatarUrl === undefined ? character.avatarUrl : input.avatarUrl;
    if (nextVisibility === "PUBLIC") {
      if (!nextAvatarUrl?.trim()) {
        throw new HttpError(400, "Add an avatar before publishing a character publicly.");
      }
      const nextScenario = input.scenario === undefined ? character.scenario : input.scenario;
      if (!nextScenario?.trim()) {
        throw new HttpError(400, "Add a scenario before publishing a character publicly.");
      }
      const nextPersona = input.persona === undefined ? character.persona : input.persona;
      if (!nextPersona || (typeof nextPersona === "object" && Object.keys(nextPersona as Record<string, unknown>).length === 0)) {
        throw new HttpError(400, "Add persona details before publishing a character publicly.");
      }
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
        tags: input.tags === undefined ? undefined : normalizeCharacterTags(input.tags),
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        communicationStyle: input.communicationStyle === undefined ? undefined : input.communicationStyle ?? Prisma.JsonNull,
        persona: input.persona === undefined ? undefined : input.persona ?? Prisma.JsonNull,
        lorebook: input.lorebook === undefined ? undefined : input.lorebook ?? Prisma.JsonNull,
        visualIdentity: input.visualIdentity === undefined ? undefined : input.visualIdentity ?? Prisma.JsonNull,
        // Edits and visibility changes are re-approved only after the merged character text passes moderation.
        moderationStatus: "APPROVED"
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
    const character = await prisma.character.findFirst({
      where: {
        id: (await context.params).id,
        ...(user.role === "ADMIN" ? {} : { creatorId: user.id })
      },
      select: { creatorId: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
    }

    await prisma.character.delete({ where: { id: (await context.params).id } });
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:clone"
    });

    const source = await prisma.character.findUnique({
      where: { id: (await context.params).id }
    });

    if (!source || source.visibility !== "PUBLIC" || source.moderationStatus !== "APPROVED" || source.blockedAt) {
      throw new HttpError(404, "Public character not found.");
    }

    const clone = await prisma.character.create({
      data: {
        creatorId: user.id,
        cloneSourceId: source.id,
        creationMode: source.creationMode,
        name: `${source.name} remix`,
        avatarUrl: source.avatarUrl,
        description: source.description,
        personality: source.personality,
        scenario: source.scenario,
        greeting: source.greeting,
        communicationStyle: source.communicationStyle ?? Prisma.JsonNull,
        persona: source.persona ?? Prisma.JsonNull,
        lorebook: source.lorebook ?? Prisma.JsonNull,
        visualIdentity: source.visualIdentity ?? Prisma.JsonNull,
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

function isMinor(birthDate: Date | null) {
  if (!birthDate) {
    return false;
  }

  const ageMs = Date.now() - birthDate.getTime();
  return ageMs < 18 * 365.25 * 24 * 60 * 60 * 1000;
}
