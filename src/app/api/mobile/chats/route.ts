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
import { getPreferredPersonaId } from "@/lib/user-persona-store";
import { renderCharacterPrologue } from "@/lib/prologue-pov";

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
        messages: {
          orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            content: true,
            role: true,
            createdAt: true
          }
        }
      }
    });

    return json({ chats });
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

    const [providerKeys, defaultPersonaId] = await Promise.all([
      getEffectiveProviderKeys(user.id),
      getPreferredPersonaId(user.id, character.id)
    ]);
    const defaultPersona = defaultPersonaId
      ? await prisma.userPersona.findFirst({
          where: { id: defaultPersonaId, userId: user.id },
          select: { displayName: true }
        })
      : null;
    const prologue = renderCharacterPrologue({
      greeting: character.greeting,
      characterName: character.name,
      communicationStyle: character.communicationStyle,
      userPersonaName: defaultPersona?.displayName
    });
    const effectiveSettings = resolveCharacterModelSettings({
      character,
      providerKeys,
      globalModel: input.model ?? userPreferredModelValue(user),
      chatTemperature: input.temperature
    });
    const model = input.model ?? effectiveSettings.model;

    const chat = await prisma.$transaction(async (tx) => {
      const created = await tx.chat.create({
        data: {
          userId: user.id,
          characterId: character.id,
          personaId: defaultPersonaId,
          title: input.title ?? null,
          temperature: input.temperature,
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
          content: prologue,
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
