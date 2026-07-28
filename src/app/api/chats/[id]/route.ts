import { prisma } from "@/lib/prisma";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { measurePrismaOperation } from "@/lib/performance-logger";
import { splitProviderModelValue } from "@/lib/provider-model-options";
import { chatUpdateSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id: chatId } = await context.params;
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "chats:read" });
    const chat = await measurePrismaOperation(
      {
        route: "chat:get",
        operation: "load_conversation"
      },
      () =>
        prisma.chat.findFirst({
          where: {
            id: chatId,
            userId: user.id
          },
          include: {
            character: true,
            persona: true,
            messages: {
              orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
              take: 200
            }
          }
        }),
      (result) => ({
        found: Boolean(result),
        messageCount: result?.messages.length ?? 0
      })
    );

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    chat.messages.reverse();
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
        id: (await context.params).id,
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

    const selectedModel = input.model?.trim();
    const selectedProviderModel = splitProviderModelValue(selectedModel);
    const chatUpdate = prisma.chat.update({
      where: { id: chat.id },
      data: {
        title: input.title,
        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
        temperature: input.temperature,
        model: selectedModel,
        responsePrompt: input.responsePrompt === undefined ? undefined : input.responsePrompt || null,
        lastActiveAt: new Date()
      }
    });

    const [updated] =
      selectedModel === undefined
        ? [await chatUpdate]
        : await prisma.$transaction([
            chatUpdate,
            prisma.user.update({
              where: { id: user.id },
              data: {
                preferredProvider: selectedProviderModel?.provider ?? null,
                preferredModel: selectedProviderModel?.model ?? selectedModel
              }
            })
          ]);

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
        id: (await context.params).id,
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
