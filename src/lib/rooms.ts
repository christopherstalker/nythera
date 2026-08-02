import "server-only";

import crypto from "crypto";
import { MessageRole, RoomMessageRole, type Character, type UserPersona } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { createRoomMessageWithNextSequence } from "@/lib/message-sequence";
import { estimateModelCost } from "@/lib/model-pricing";
import { assembleNytheraPrompt } from "@/lib/prompt-assembly";
import { loadAdaptiveRoomHistory } from "@/lib/chat-history";
import { detectPromptInjection } from "@/lib/prompt-security";
import { prisma } from "@/lib/prisma";
import { streamLlmResponse } from "@/lib/proxy";
import { userPreferredModelValue } from "@/lib/provider-model-options";
import { moderateText, sanitizeUserText, isMinorBirthDate } from "@/lib/safety";
import { formatUserPersonaForPrompt } from "@/lib/user-persona";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { getPromptMemories } from "@/lib/memory-store";
import { ensureStoryForRoom, getRoomStoryPromptContext, syncRoomTurns } from "@/lib/stories/story-foundation";
import { markStoryProactiveEventsFired } from "@/lib/stories/narrative-store";
import { logSafeError } from "@/lib/secret-redaction";

type RoomUser = {
  id: string;
  role: string;
  birthDate: Date | null;
  memoryEnabled: boolean;
  preferredProvider?: string | null;
  preferredModel?: string | null;
};

type RoomInput = {
  title?: string;
  characterIds: string[];
  model?: string;
  temperature: number;
  responsePrompt?: string;
};

type RoomMessageInput = {
  message: string;
  requestId?: string;
  characterId?: string;
  model?: string;
  temperature?: number;
};

export async function listRoomsForUser(userId: string) {
  return prisma.room.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ lastActiveAt: "desc" }, { updatedAt: "desc" }],
    include: {
      characters: {
        orderBy: { position: "asc" },
        include: {
          character: {
            select: { id: true, name: true, description: true, avatarUrl: true }
          }
        }
      },
      messages: {
        orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
        take: 1,
        include: {
          character: {
            select: { id: true, name: true, avatarUrl: true }
          }
        }
      }
    }
  });
}

export async function getRoomForUser(roomId: string, userId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, userId, archivedAt: null },
    include: roomInclude()
  });

  if (!room) {
    throw new HttpError(404, "Room not found.");
  }

  room.messages.reverse();
  return room;
}

export async function createRoomForUser(user: RoomUser, input: RoomInput) {
  const uniqueIds = Array.from(new Set(input.characterIds));
  if (uniqueIds.length < 2) {
    throw new HttpError(400, "A room needs at least two characters.");
  }

  const characters = await prisma.character.findMany({
    where: { id: { in: uniqueIds }, blockedAt: null }
  });
  const orderedCharacters = uniqueIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is Character => Boolean(character));
  const unavailable = orderedCharacters.length !== uniqueIds.length || orderedCharacters.some((character) => !canUseCharacter(character, user));
  if (unavailable) {
    throw new HttpError(404, "One or more characters are unavailable.");
  }

  const providerKeys = await getEffectiveProviderKeys(user.id);
  const defaultPersona = await prisma.userPersona.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true }
  });
  const primary = orderedCharacters[0];
  const settings = resolveCharacterModelSettings({
    character: primary,
    providerKeys,
    globalModel: input.model ?? userPreferredModelValue(user),
    chatTemperature: input.temperature
  });
  const title = input.title?.trim() || orderedCharacters.map((character) => character.name).slice(0, 3).join(", ");

  const created = await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        userId: user.id,
        personaId: defaultPersona?.id ?? null,
        title,
        model: input.model || settings.model,
        temperature: settings.temperature,
        responsePrompt: input.responsePrompt?.trim() || null,
        messageCount: orderedCharacters.length,
        characters: {
          create: orderedCharacters.map((character, position) => ({
            characterId: character.id,
            position
          }))
        }
      }
    });

    await Promise.all(
      orderedCharacters.map((character, index) =>
        tx.roomMessage.create({
          data: {
            roomId: room.id,
            sequence: index + 1,
            role: RoomMessageRole.CHARACTER,
            characterId: character.id,
            content: character.greeting,
            model: room.model
          }
        })
      )
    );

    return room;
  });

  await ensureStoryForRoom(created.id, user.id);

  return getRoomForUser(created.id, user.id);
}

export async function patchRoomForUser(roomId: string, userId: string, input: { title?: string; responsePrompt?: string; archived?: boolean }) {
  const existing = await prisma.room.findFirst({ where: { id: roomId, userId }, select: { id: true } });
  if (!existing) {
    throw new HttpError(404, "Room not found.");
  }

  const room = await prisma.room.update({
    where: { id: roomId },
    data: {
      title: input.title,
      responsePrompt: input.responsePrompt === undefined ? undefined : input.responsePrompt.trim() || null,
      archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
      updatedAt: new Date()
    },
    include: roomInclude()
  });

  return room;
}

export async function deleteRoomForUser(roomId: string, userId: string) {
  const deleted = await prisma.room.deleteMany({ where: { id: roomId, userId } });
  if (deleted.count === 0) {
    throw new HttpError(404, "Room not found.");
  }
}

export async function sendRoomMessage(input: {
  roomId: string;
  user: RoomUser;
  body: RoomMessageInput;
  signal?: AbortSignal;
}) {
  const started = Date.now();
  const rawMessage = input.body.message;
  const message = sanitizeUserText(rawMessage);
  const injectionAssessment = detectPromptInjection(message);
  const moderation = moderateText({
    text: message,
    userIsMinor: isMinorBirthDate(input.user.birthDate),
    context: "message"
  });

  if (!moderation.allowed) {
    throw new HttpError(400, moderation.reason ?? "Message blocked by safety policy.");
  }

  const room = await prisma.room.findFirst({
    where: { id: input.roomId, userId: input.user.id, archivedAt: null },
    include: {
      persona: true,
      characters: {
        orderBy: { position: "asc" },
        include: { character: true }
      },
      messages: {
        orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
        take: 48,
        include: {
          character: {
            select: { id: true, name: true, avatarUrl: true }
          }
        }
      }
    }
  });

  if (!room) {
    throw new HttpError(404, "Room not found.");
  }

  if (input.body.requestId) {
    const existingMessage = await prisma.roomMessage.findUnique({
      where: { clientRequestId: input.body.requestId },
      select: { id: true, roomId: true }
    });

    if (existingMessage?.roomId === room.id) {
      throw new HttpError(409, "Duplicate room request ignored.");
    }
  }

  const speakerLink = selectSpeaker(room.characters, room.messages, input.body.characterId);
  const speaker = speakerLink.character;
  const providerKeys = await getEffectiveProviderKeys(input.user.id);
  const effectiveSettings = resolveCharacterModelSettings({
    character: speaker,
    providerKeys,
    globalModel: input.body.model ?? room.model,
    chatTemperature: input.body.temperature ?? room.temperature
  });
  const history = await loadAdaptiveRoomHistory({
    roomId: room.id,
    model: effectiveSettings.model,
    maxOutputTokens: effectiveSettings.maxTokens,
    currentMessage: message,
    summary: room.summary
  });
  const userMessage = await createRoomMessageWithNextSequence({
    roomId: room.id,
    role: RoomMessageRole.USER,
    content: message,
    clientRequestId: input.body.requestId
  });

  const [memories, defaultPersona, storyContext] = await Promise.all([
    input.user.memoryEnabled
      ? getPromptMemories({
          userId: input.user.id,
          characterId: speaker.id,
          query: message,
          providerKeys
        })
      : Promise.resolve([]),
    prisma.userPersona.findFirst({
      where: { userId: input.user.id, isDefault: true }
    }),
    getRoomStoryPromptContext({ roomId: room.id, userId: input.user.id, actorCharacterId: speaker.id })
  ]);
  const userPersona = room.persona ?? defaultPersona;
  const recentMessages = history.messages
    .map((roomMessage) => ({
      role: roomMessage.role === RoomMessageRole.CHARACTER ? MessageRole.ASSISTANT : roomMessage.role === RoomMessageRole.SYSTEM ? MessageRole.SYSTEM : MessageRole.USER,
      content: formatRoomMessageForPrompt(roomMessage)
    }));
  const prompt = assembleNytheraPrompt({
    character: speaker,
    memories,
    userPersona: formatUserPersonaForPrompt(userPersona as UserPersona | null),
    summary: history.overflowed ? room.summary : null,
    recentMessages,
    currentMessage: message,
    responsePrompt: buildRoomResponsePrompt({
      roomPrompt: room.responsePrompt,
      transientPrompt: undefined,
      speaker,
      characters: room.characters.map((link) => link.character)
    }),
    storyContext: storyContext.text,
    injectionAssessment
  });

  let assistantText = "";
  let outputBlocked = false;
  let usage = {
    inputTokens: 0,
    outputTokens: 0,
    model: effectiveSettings.model,
    provider: "unknown",
    usageEstimated: true,
    fallbackTriggered: false,
    attempts: [] as string[]
  };

  for await (const chunk of streamLlmResponse({
    messages: prompt,
    model: effectiveSettings.model,
    temperature: effectiveSettings.temperature,
    topP: effectiveSettings.topP,
    frequencyPenalty: effectiveSettings.frequencyPenalty,
    presencePenalty: effectiveSettings.presencePenalty,
    maxTokens: effectiveSettings.maxTokens,
    userId: input.user.id,
    chatId: room.id,
    providerKeys,
    signal: input.signal
  })) {
    if (chunk.type === "delta") {
      const nextText = assistantText + chunk.text;
      const check = moderateText({
        text: nextText,
        userIsMinor: isMinorBirthDate(input.user.birthDate),
        context: "assistant"
      });

      if (!check.allowed) {
        outputBlocked = true;
        assistantText = check.reason ?? "The response was stopped because it did not pass the platform safety policy.";
        break;
      }

      assistantText = nextText;
    }

    if (chunk.type === "usage") {
      usage = {
        inputTokens: chunk.inputTokens,
        outputTokens: chunk.outputTokens,
        model: chunk.model,
        provider: chunk.provider,
        usageEstimated: chunk.usageEstimated,
        fallbackTriggered: chunk.fallbackTriggered ?? false,
        attempts: chunk.attempts ?? []
      };
    }

    if (chunk.type === "error") {
      throw new Error(chunk.message);
    }
  }

  if (!assistantText.trim()) {
    throw new Error("The model returned an empty response.");
  }

  const estimatedCost = estimateModelCost({
    provider: usage.provider,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens
  });

  const characterMessage = await createRoomMessageWithNextSequence({
    roomId: room.id,
    role: RoomMessageRole.CHARACTER,
    characterId: speaker.id,
    content: assistantText,
    model: usage.model,
    tokens: usage.outputTokens,
    provider: usage.provider,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCost,
    usageEstimated: usage.usageEstimated,
    flagged: outputBlocked,
    clientRequestId: `room-${input.body.requestId || crypto.randomUUID()}`
  });

  const actualMessageCount = await prisma.roomMessage.count({ where: { roomId: room.id } });
  const updatedRoom = await prisma.room.update({
    where: { id: room.id },
    data: {
      messageCount: actualMessageCount,
      model: effectiveSettings.model,
      temperature: effectiveSettings.temperature,
      lastActiveAt: new Date(),
      updatedAt: new Date()
    },
    select: { id: true, title: true, messageCount: true, lastActiveAt: true }
  });

  await prisma.llmRequestLog.create({
    data: {
      userId: input.user.id,
      provider: usage.provider,
      model: usage.model,
      route: "room",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCost,
      status: outputBlocked ? "blocked_output" : usage.fallbackTriggered ? "ok_fallback" : "ok",
      error: usage.fallbackTriggered ? `fallback attempts: ${usage.attempts.join(" -> ")}`.slice(0, 2000) : null,
      latencyMs: Date.now() - started
    }
  });

  await syncRoomTurns(room.id, input.user.id).catch((storyError) => {
    logSafeError("Room story turn sync failed.", storyError);
  });
  await markStoryProactiveEventsFired({
    eventIds: storyContext.eventIds,
    storyId: storyContext.storyId,
    sourceRoomMessageId: characterMessage.id
  }).catch((storyError) => {
    logSafeError("Room proactive event completion failed.", storyError);
  });

  return {
    room: updatedRoom,
    userMessage,
    characterMessage,
    speaker: {
      id: speaker.id,
      name: speaker.name,
      avatarUrl: speaker.avatarUrl
    }
  };
}

function roomInclude() {
  return {
    persona: true,
    characters: {
      orderBy: { position: "asc" as const },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            greeting: true,
            visibility: true,
            moderationStatus: true,
            creatorId: true
          }
        }
      }
    },
    messages: {
      orderBy: [{ createdAt: "desc" as const }, { sequence: "desc" as const }, { id: "desc" as const }],
      take: 200,
      include: {
        character: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    }
  };
}

function canUseCharacter(character: Character, user: Pick<RoomUser, "id" | "role">) {
  const approved = character.moderationStatus === "APPROVED";
  const visible = character.visibility === "PUBLIC" || character.visibility === "UNLISTED";
  return (approved && visible) || character.creatorId === user.id || user.role === "ADMIN";
}

function selectSpeaker<T extends { characterId: string; position: number; character: Character }>(
  links: T[],
  messages: Array<{ role: RoomMessageRole; characterId: string | null }>,
  requestedCharacterId?: string
) {
  if (requestedCharacterId) {
    const requested = links.find((link) => link.characterId === requestedCharacterId);
    if (!requested) {
      throw new HttpError(400, "Selected speaker is not in this room.");
    }
    return requested;
  }

  const latestCharacterMessage = messages.find((message) => message.role === RoomMessageRole.CHARACTER && message.characterId);
  const latestIndex = latestCharacterMessage
    ? links.findIndex((link) => link.characterId === latestCharacterMessage.characterId)
    : -1;
  return links[(latestIndex + 1) % links.length] ?? links[0];
}

function formatRoomMessageForPrompt(message: {
  role: RoomMessageRole;
  content: string;
  character?: { name: string | null } | null;
}) {
  if (message.role === RoomMessageRole.CHARACTER) {
    return `${message.character?.name ?? "Character"}: ${message.content}`;
  }
  if (message.role === RoomMessageRole.SYSTEM) {
    return `Room note: ${message.content}`;
  }
  return `User: ${message.content}`;
}

function buildRoomResponsePrompt(input: {
  roomPrompt?: string | null;
  transientPrompt?: string;
  speaker: Character;
  characters: Character[];
}) {
  const cast = input.characters.map((character) => character.name).join(", ");
  return [
    "GROUP ROOM TURN RULES",
    `Current speaker: ${input.speaker.name}.`,
    `Room cast: ${cast}.`,
    "- Lead the turn with the current speaker while keeping other present NPCs believably active when scene logic calls for it.",
    "- Do not write the user's next message.",
    "- Keep continuity with the other characters' visible turns.",
    input.roomPrompt?.trim() ? `Room direction: ${input.roomPrompt.trim()}` : null,
    input.transientPrompt?.trim() ? `Turn direction: ${input.transientPrompt.trim()}` : null
  ]
    .filter(Boolean)
    .join("\n");
}
