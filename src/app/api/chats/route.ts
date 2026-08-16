import { MessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { userPreferredModelValue } from "@/lib/provider-model-options";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { chatCreateSchema } from "@/lib/validation";
import { ensureStoryForChat } from "@/lib/stories/story-foundation";
import { getRecentChats } from "@/lib/recent-chats";
import { requireAdultConsent } from "@/lib/adult-consent";
import { getPreferredPersonaId } from "@/lib/user-persona-store";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    requireAdultConsent(user);
    const characterId = new URL(request.url).searchParams.get("characterId");
    if (characterId && characterId.length > 120) {
      throw new HttpError(400, "Invalid character filter.");
    }
    const chats = await getRecentChats(user.id, characterId ? 60 : 20, characterId);

    return json({ chats });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireAdultConsent(user);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chats:create"
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

    const providerKeys = await getEffectiveProviderKeys(user.id);
    const defaultPersonaId = await getPreferredPersonaId(user.id, character.id);
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
          content: character.greeting,
          model
        }
      });

      return created;
    });
    await ensureStoryForChat(chat.id, user.id);

    return json({ chat }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
