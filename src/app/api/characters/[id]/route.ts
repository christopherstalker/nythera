import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { characterUpdateSchema } from "@/lib/validation";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";
import { deleteCharacterForUser, updateCharacterForUser } from "@/lib/character-mutations";

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
    const input = await parseJson(request, characterUpdateSchema);
    const updated = await updateCharacterForUser((await context.params).id, input, user);

    return json({ character: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    await deleteCharacterForUser((await context.params).id, user);
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
