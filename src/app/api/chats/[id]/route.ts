import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { measurePrismaOperation } from "@/lib/performance-logger";
import { splitProviderModelValue } from "@/lib/provider-model-options";
import { chatUpdateSchema } from "@/lib/validation";
import { requireAdultConsent } from "@/lib/adult-consent";
import { prepareContinuationTurn } from "@/lib/message-actions";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id: chatId } = await context.params;
    const user = await requireUser();
    requireAdultConsent(user);
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

    const chapterNumber = await prisma.chat.count({
      where: {
        userId: user.id,
        characterId: chat.characterId,
        OR: [
          { createdAt: { lt: chat.createdAt } },
          { createdAt: chat.createdAt, id: { lte: chat.id } }
        ]
      }
    });

    chat.messages.reverse();
    return json({ chat: { ...chat, chapterNumber } }, { headers: { "Cache-Control": "private, no-store" } });
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

    const isActiveSelectionOnly =
      input.activeAssistantMessageId !== undefined &&
      input.title === undefined &&
      input.archived === undefined &&
      input.temperature === undefined &&
      input.model === undefined &&
      input.responsePrompt === undefined &&
      input.chatMode === undefined &&
      input.appearance === undefined;
    if (isActiveSelectionOnly && chat.activeAssistantMessageId === input.activeAssistantMessageId) {
      return json({ chat });
    }

    if (input.activeAssistantMessageId) {
      const latestMessages = await prisma.message.findMany({
        where: { chatId: chat.id },
        orderBy: [{ sequence: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 40,
        select: { id: true, role: true, content: true, clientRequestId: true, branchSourceMessageId: true }
      });
      if (!prepareContinuationTurn(latestMessages.reverse(), input.activeAssistantMessageId)) {
        throw new HttpError(409, "Only a response from the latest version group can be selected as the active branch.");
      }
    }

    const selectedModel = input.model?.trim();
    const selectedProviderModel = splitProviderModelValue(selectedModel);
    const userModelPreferences = selectedModel === undefined
      ? {}
      : {
          preferredProvider: selectedProviderModel?.provider ?? null,
          preferredModel: selectedProviderModel?.model ?? selectedModel
        };
    const chatUpdate = prisma.chat.update({
      where: { id: chat.id },
      data: {
        title: input.title,
        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
        temperature: input.temperature,
        model: selectedModel,
        responsePrompt: input.responsePrompt === undefined ? undefined : input.responsePrompt || null,
        chatMode: input.chatMode,
        activeAssistantMessageId: input.activeAssistantMessageId,
        appearance: input.appearance === undefined
          ? undefined
          : input.appearance === null
            ? Prisma.DbNull
            : input.appearance as Prisma.InputJsonValue,
        lastActiveAt: new Date()
      }
    });

    const shouldUpdateUser = selectedModel !== undefined || input.responsePrompt !== undefined || input.chatMode !== undefined;
    const [updated] =
      !shouldUpdateUser
        ? [await chatUpdate]
        : await prisma.$transaction([
            chatUpdate,
            prisma.user.update({
              where: { id: user.id },
              data: {
                ...userModelPreferences,
                defaultResponsePrompt: input.responsePrompt === undefined ? undefined : input.responsePrompt || null,
                preferredChatMode: input.chatMode
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
