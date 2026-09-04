import { json, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { renderInitialChatGreeting } from "@/lib/character-prompt-contract";

type Context = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const take = Math.min(Number(searchParams.get("take") ?? 80), 120);
    const chat = await prisma.chat.findFirst({
      where: {
        id: (await context.params).id,
        userId: user.id
      },
      select: {
        id: true,
        character: { select: { name: true } },
        persona: { select: { displayName: true, surname: true } }
      }
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const persona = chat.persona ?? await prisma.userPersona.findFirst({
      where: { userId: user.id, isDefault: true },
      select: { displayName: true, surname: true }
    });
    return json({
      messages: messages.reverse().map((message) => renderInitialChatGreeting(
        message,
        chat.character.name,
        persona
      ))
    });
  } catch (error) {
    return routeError(error);
  }
}
