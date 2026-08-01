import { Prisma, Visibility } from "@prisma/client";
import { z } from "zod";
import { json, parseJson, routeError, HttpError, getRequestIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { characterCreateSchema } from "@/lib/validation";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createCharacterForUser } from "@/lib/character-mutations";

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
    const character = await createCharacterForUser(input, user);

    return json({ character }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
