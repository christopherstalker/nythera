import { json, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

type Context = {
  params: {
    id: string;
  };
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
        id: context.params.id,
        userId: user.id
      },
      select: { id: true }
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

    return json({ messages: messages.reverse() });
  } catch (error) {
    return routeError(error);
  }
}
