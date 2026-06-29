import { Prisma, Visibility } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText } from "@/lib/safety";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { characterCreateSchema } from "@/lib/validation";
import { DISCOVERY_TAGS, expandTagQuery, normalizeCharacterTags } from "@/lib/character-tags";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "true";
    const search = searchParams.get("q")?.trim();
    const tags = [
      ...searchParams.getAll("tag"),
      ...(searchParams.get("tags")?.split(",") ?? [])
    ].map((tag) => tag.trim()).filter(Boolean);
    const visibility = searchParams.get("visibility") as Visibility | null;
    const sort = searchParams.get("sort") ?? "trending";
    const nsfw = searchParams.get("nsfw") ?? "safe";
    const minRating = Number(searchParams.get("ratingMin") ?? 0);
    const take = Math.min(Number(searchParams.get("take") ?? 24), 50);

    const where: Prisma.CharacterWhereInput = mine
      ? { creatorId: session?.user?.id ?? "__none__" }
      : {
          visibility: Visibility.PUBLIC,
          moderationStatus: "APPROVED",
          blockedAt: null,
          AND: [
            { name: { not: "" } },
            { description: { not: "" } },
            { greeting: { not: "" } },
            { personality: { not: "" } },
            { scenario: { not: null } },
            { scenario: { not: "" } },
            { persona: { not: Prisma.JsonNull } }
          ]
        };

    if (visibility && mine) {
      where.visibility = visibility;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { personality: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: expandTagQuery(search) } }
      ];
    }

    if (tags.length > 0) {
      where.tags = { hasSome: tags.flatMap(expandTagQuery) };
    }

    if (!mine) {
      if (nsfw === "only") {
        where.isNSFW = true;
      } else if (nsfw !== "include") {
        where.isNSFW = false;
      }
    }

    if (Number.isFinite(minRating) && minRating > 0) {
      where.ratingAverage = { gte: Math.min(Math.max(minRating, 1), 5) };
    }

    const orderBy =
      sort === "new"
        ? [{ createdAt: "desc" as const }]
        : sort === "top-rated"
          ? [{ ratingAverage: "desc" as const }, { ratingCount: "desc" as const }, { likes: "desc" as const }]
          : [{ likes: "desc" as const }, { ratingAverage: "desc" as const }, { createdAt: "desc" as const }];

    const characters = await prisma.character.findMany({
      where,
      orderBy,
      take,
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

    return json({ characters: characters.map(redactCharacterModelSettings), tags: DISCOVERY_TAGS });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:create"
    });

    const input = await parseJson(request, characterCreateSchema);
    const tags = normalizeCharacterTags(input.tags);
    if (input.isNSFW && !user.ageVerified) {
      throw new HttpError(403, "Confirm age-gated access in profile settings before creating NSFW characters.");
    }

    if (input.visibility === "PUBLIC") {
      if (!input.avatarUrl?.trim()) {
        throw new HttpError(400, "Add an avatar before publishing a character publicly.");
      }
      if (!input.scenario?.trim()) {
        throw new HttpError(400, "Add a scenario before publishing a character publicly.");
      }
      if (!input.persona || Object.keys(input.persona).length === 0) {
        throw new HttpError(400, "Add persona details before publishing a character publicly.");
      }
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
        tags,
        isNSFW: input.isNSFW,
        // Public characters become discoverable immediately after automated safety moderation passes.
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

  const ageMs = Date.now() - birthDate.getTime();
  return ageMs < 18 * 365.25 * 24 * 60 * 60 * 1000;
}
