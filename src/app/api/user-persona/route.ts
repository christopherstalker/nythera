import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userPersonaSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const persona = await prisma.userPersona.findUnique({
      where: { userId: user.id }
    });

    return json({ persona });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, userPersonaSchema);
    const persona = await prisma.userPersona.upsert({
      where: { userId: user.id },
      update: {
        displayName: input.displayName,
        avatarUrl: input.avatarUrl || null,
        summary: input.summary,
        background: input.background || null,
        traits: input.traits,
        likes: input.likes,
        dislikes: input.dislikes,
        boundaries: input.boundaries,
        visibility: input.visibility
      },
      create: {
        userId: user.id,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl || null,
        summary: input.summary,
        background: input.background || null,
        traits: input.traits,
        likes: input.likes,
        dislikes: input.dislikes,
        boundaries: input.boundaries,
        visibility: input.visibility
      }
    });

    return json({ persona });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.userPersona.deleteMany({ where: { userId: user.id } });
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
