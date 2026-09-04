import { getRequestIp, json, parseJson, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { chatUpdateSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { renderInitialChatGreeting } from "@/lib/character-prompt-contract";
import { formatUserPersonaForPrompt } from "@/lib/user-persona";
import { getChatInputLimits } from "@/lib/chat-limits.server";

type Context = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "mobile:chats:read" });
    const chat = await prisma.chat.findFirst({
      where: {
        id: (await context.params).id,
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
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const persona = chat.persona ?? await prisma.userPersona.findFirst({
      where: { userId: user.id, isDefault: true }
    });
    const userPersona = formatUserPersonaForPrompt(persona);
    const messages = chat.messages.reverse().map((message) => renderInitialChatGreeting(
      message,
      chat.character.name,
      userPersona
    ));
    return json({ chat: { ...chat, messages, inputLimits: getChatInputLimits(user.id) } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    const input = await parseJson(request, chatUpdateSchema);
    const inputLimits = getChatInputLimits(user.id);
    if ((input.responsePrompt?.length ?? 0) > inputLimits.responsePrompt) {
      throw new HttpError(400, `Custom system prompt must be ${inputLimits.responsePrompt.toLocaleString()} characters or fewer.`);
    }
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

    const chatUpdate = prisma.chat.update({
      where: { id: chat.id },
      data: {
        title: input.title,
        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
        temperature: input.temperature,
        model: input.model,
        responsePrompt: input.responsePrompt === undefined ? undefined : input.responsePrompt || null,
        chatMode: input.chatMode,
        lastActiveAt: new Date()
      }
    });
    const [updated] = input.temperature === undefined && input.responsePrompt === undefined && input.chatMode === undefined
      ? [await chatUpdate]
      : await prisma.$transaction([
          chatUpdate,
          prisma.user.update({
            where: { id: user.id },
            data: {
              defaultTemperature: input.temperature,
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

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
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
