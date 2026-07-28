import { Prisma, Visibility } from "@prisma/client";
import { z } from "zod";
import { json, parseJson, routeError, HttpError, getRequestIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { characterCreateSchema } from "@/lib/validation";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";
import { moderateText } from "@/lib/safety";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(64).optional(),
  mine: z.string().optional(),
  take: z.coerce.number().min(1).max(50).optional()
});

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "mobile:characters:read"
    });
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const user = request.headers.get("authorization") ? await requireMobileUser(request).catch(() => null) : null;
    const mine = query.mine === "true";
    const where: Prisma.CharacterWhereInput = mine
      ? { creatorId: user?.id ?? "__none__" }
      : {
          visibility: Visibility.PUBLIC,
          moderationStatus: "APPROVED",
          blockedAt: null,
          AND: [{ avatarUrl: { not: null } }, { avatarUrl: { not: "" } }]
        };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { personality: { contains: query.q, mode: "insensitive" } }
      ];
    }

    if (query.tag) {
      where.tags = { has: query.tag };
    }

    const characters = await prisma.character.findMany({
      where,
      orderBy: [{ likes: "desc" }, { createdAt: "desc" }],
      take: query.take ?? 30,
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

    return json({ characters: characters.map(redactCharacterModelSettings) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser(request);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:characters:create"
    });

    const input = await parseJson(request, characterCreateSchema);
    if (input.isNSFW && !user.ageVerified) {
      throw new HttpError(403, "Confirm age-gated access in profile settings before creating NSFW characters.");
    }

    if (input.visibility === "PUBLIC" && !input.avatarUrl?.trim()) {
      throw new HttpError(400, "Add an avatar before publishing a character publicly.");
    }

    const moderation = moderateText({
      text: [
        input.name,
        input.description,
        input.personality,
        input.scenario,
        input.greeting,
        input.systemPromptOverride,
        JSON.stringify(input.persona ?? {}),
        JSON.stringify(input.lorebook ?? {})
      ]
        .filter(Boolean)
        .join("\n"),
      userIsMinor: isMinor(user.birthDate),
      context: "character"
    });

    if (!moderation.allowed) {
      throw new HttpError(400, moderation.reason ?? "Character content did not pass moderation.");
    }

    const character = await prisma.character.create({
      data: {
        creatorId: user.id,
        creationMode: input.creationMode,
        name: input.name,
        avatarUrl: input.avatarUrl || null,
        description: input.description,
        personality: input.personality,
        scenario: input.scenario,
        greeting: input.greeting,
        communicationStyle: input.communicationStyle ?? Prisma.JsonNull,
        persona: input.persona ?? Prisma.JsonNull,
        lorebook: input.lorebook ?? Prisma.JsonNull,
        visualIdentity: input.visualIdentity ?? Prisma.JsonNull,
        preferredProvider: input.preferredProvider,
        preferredModel: input.preferredModel,
        temperature: input.temperature,
        topP: input.topP,
        frequencyPenalty: input.frequencyPenalty,
        presencePenalty: input.presencePenalty,
        maxTokens: input.maxTokens,
        systemPromptOverride: input.systemPromptOverride,
        visibility: input.visibility,
        tags: input.tags,
        isNSFW: input.isNSFW,
        // Mobile and web clients share the same public behavior: approved public characters show in Explore immediately.
        moderationStatus: "APPROVED"
      }
    });

    return json({ character }, { status: 201 });
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
