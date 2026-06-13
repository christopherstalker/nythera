import { prisma } from "@/lib/prisma";
import { titleFromMessage } from "@/lib/utils";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { chatUpdateSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const chat = await prisma.chat.findFirst({
      where: {
        id: context.params.id,
        userId: user.id
      },
      include: {
        character: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }]
        }
      }
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    return json({ chat });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, chatUpdateSchema);
    const chat = await prisma.chat.findFirst({
      where: {
        id: context.params.id,
        userId: user.id
      },
      include: {
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }],
          take: 2
        }
      }
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const updated = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        title: input.title ?? (chat.title || titleFromMessage(chat.messages[0]?.content ?? "Untitled chat")),
        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
        temperature: input.temperature,
        model: input.model,
        lastActiveAt: new Date()
      }
    });

    return json({ chat: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
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

    await prisma.chat.update({
      where: { id: chat.id },
      data: { archivedAt: new Date() }
    });

    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
