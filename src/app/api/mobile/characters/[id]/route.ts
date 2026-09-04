import { json, parseJson, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { characterUpdateSchemaFor } from "@/lib/validation";
import { redactCharacterModelSettings } from "@/lib/character-model-settings";
import { updateCharacterForUser } from "@/lib/character-mutations";

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
    const unlimitedCharacterFields = user.unlimitedCharacterFields;
    const input = await parseJson(request, characterUpdateSchemaFor(unlimitedCharacterFields), {
      maxBytes: unlimitedCharacterFields ? null : undefined
    });
    const updated = await updateCharacterForUser((await context.params).id, input, user);

    return json({ character: updated });
  } catch (error) {
    return routeError(error);
  }
}
