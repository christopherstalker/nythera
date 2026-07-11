import { prisma } from "@/lib/prisma";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { measurePrismaOperation } from "@/lib/performance-logger";
import { splitProviderModelValue } from "@/lib/provider-model-options";
import { chatUpdateSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const chat = await measurePrismaOperation(
      {
        route: "chat:get",
        operation: "load_conversation"
      },
      () =>
        prisma.chat.findFirst({
          where: {
            id: context.params.id,
            userId: user.id
          },
          include: {
            character: true,
            persona: true,
            messages: {
              orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }]
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
