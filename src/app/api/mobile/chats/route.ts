import { MessageRole } from "@prisma/client";
import { json, parseJson, routeError, HttpError, getRequestIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { userPreferredModelValue } from "@/lib/provider-model-options";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { chatCreateSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireAdultConsent } from "@/lib/adult-consent";
import { getPreferredPersona } from "@/lib/user-persona-store";
import { formatUserPersonaForPrompt } from "@/lib/user-persona";
import { renderCharacterGreeting, renderInitialChatGreeting } from "@/lib/character-prompt-contract";
import { renderCharacterPrologue } from "@/lib/prologue-pov";
import { normalizeChatAppearance } from "@/lib/chat-appearance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
    requireAdultConsent(user);
    const chats = await prisma.chat.findMany({
      where: {
        userId: user.id,
        archivedAt: null
      },
      orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
      include: {
        character: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        persona: { select: { displayName: true, surname: true } },
        messages: {
          orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            content: true,
            role: true,
            sequence: true,
            createdAt: true
          }
        }
      }
    });

    const defaultPersona = chats.some((chat) => !chat.persona)
      ? await prisma.userPersona.findFirst({
          where: { userId: user.id, isDefault: true },
          select: { displayName: true, surname: true }
        })
      : null;
    const renderedChats = chats.map((chat) => {
      const persona = chat.persona ?? defaultPersona;
      const messages = chat.messages.map((message) => renderInitialChatGreeting(message, chat.character.name, persona));
      const { persona: _persona, ...serializedChat } = chat;
      return { ...serializedChat, messages };
    });

    return json({ chats: renderedChats });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser(request);
    requireAdultConsent(user);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:chats:create"
    });

    const input = await parseJson(request, chatCreateSchema);
    const character = await prisma.character.findUnique({
      where: { id: input.characterId }
    });

    if (!character || character.blockedAt) {
      throw new HttpError(404, "Character not found.");
    }

    const canAccess =
      ((character.visibility === "PUBLIC" || character.visibility === "UNLISTED") &&
        character.moderationStatus === "APPROVED") ||
      character.creatorId === user.id ||
      user.role === "ADMIN";

    if (!canAccess) {
      throw new HttpError(404, "Character not found.");
    }

    const [providerKeys, preferredPersona, preferences] = await Promise.all([
      getEffectiveProviderKeys(user.id),
      getPreferredPersona(user.id, character.id),
      prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { chatAppearance: true } })
    ]);
    const greeting = renderCharacterPrologue({
      greeting: renderCharacterGreeting(character, formatUserPersonaForPrompt(preferredPersona)),
      characterName: character.name,
      communicationStyle: character.communicationStyle,
      userPersonaName: preferredPersona?.displayName
    });
    const initialTemperature = input.temperature ?? character.temperature ?? user.defaultTemperature;
    const effectiveSettings = resolveCharacterModelSettings({
      character,
      providerKeys,
      globalModel: input.model ?? userPreferredModelValue(user),
      chatTemperature: initialTemperature
    });
    const model = input.model ?? effectiveSettings.model;

    const chat = await prisma.$transaction(async (tx) => {
      const created = await tx.chat.create({
        data: {
          userId: user.id,
          characterId: character.id,
          personaId: preferredPersona?.id ?? null,
          appearance: { ...normalizeChatAppearance(preferences.chatAppearance) },
          title: input.title ?? null,
          temperature: initialTemperature,
          model,
          responsePrompt: user.defaultResponsePrompt,
          chatMode: input.chatMode ?? character.defaultChatMode ?? user.preferredChatMode,
          messageCount: 1
        }
      });

      await tx.message.create({
        data: {
          chatId: created.id,
          sequence: 1,
          role: MessageRole.ASSISTANT,
          content: greeting,
          model
        }
      });

      return created;
    });

    const fullChat = await prisma.chat.findUnique({
      where: { id: chat.id },
      include: {
        character: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }]
        }
      }
    });

    return json({ chat: fullChat }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
