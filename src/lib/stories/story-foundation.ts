import "server-only";

import {
  MessageRole,
  Prisma,
  RoomMessageRole,
  StoryEntityType,
  StoryMode,
  StoryParticipantRole,
  StoryTurnChannel
} from "@prisma/client";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sanitizePromptContext } from "@/lib/prompt-security";
import { romanceLevelInstruction } from "@/lib/romance-level";
import { ensureAutomaticStoryCheckpoint } from "@/lib/stories/continuity-store";
import { reconcileExplicitSceneTransition } from "@/lib/stories/canon-store";

const EMPTY_WORLD_STATE = {
  time: null,
  location: null,
  weather: null,
  inventory: [],
  conditions: [],
  threats: [],
  notes: []
} satisfies Prisma.InputJsonObject;

export async function ensureStoryForChat(chatId: string, userId: string) {
  const existing = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { storyId: true, timelineId: true, timeline: { select: { isActive: true } } }
  });

  if (!existing) {
    throw new HttpError(404, "Chat not found.");
  }

  if (existing.storyId && existing.timelineId) {
    if (!existing.timeline?.isActive) {
      await activateStoryTimeline(existing.storyId, existing.timelineId);
    }
    return { storyId: existing.storyId, timelineId: existing.timelineId };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const chat = await tx.chat.findFirst({
          where: { id: chatId, userId },
          include: {
            user: { select: { name: true, username: true, email: true } },
            persona: { select: { id: true, displayName: true, summary: true } },
            character: { select: { id: true, name: true, description: true } },
            messages: { orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }] }
          }
        });

        if (!chat) {
          throw new HttpError(404, "Chat not found.");
        }
        if (chat.storyId && chat.timelineId) {
          return { storyId: chat.storyId, timelineId: chat.timelineId };
        }

        const story = await tx.story.create({
          data: {
            ownerId: userId,
            personaId: chat.personaId,
            title: chat.title?.trim() || chat.character.name,
            mode: StoryMode.SOLO,
            lastActiveAt: chat.lastActiveAt
          }
        });
        const timeline = await tx.storyTimeline.create({
          data: { storyId: story.id, label: "Original timeline", isActive: true }
        });

        await tx.storyParticipant.createMany({
          data: [
            {
              storyId: story.id,
              userId,
              personaId: chat.personaId,
              role: StoryParticipantRole.OWNER,
              displayName: chat.persona?.displayName || chat.user.name || chat.user.username || chat.user.email
            },
            {
              storyId: story.id,
              characterId: chat.characterId,
              role: StoryParticipantRole.CHARACTER,
              displayName: chat.character.name
            }
          ]
        });

        await tx.storyEntity.createMany({
          data: [
            {
              storyId: story.id,
              sourceCharacterId: chat.characterId,
              type: StoryEntityType.CHARACTER,
              canonicalKey: `character:${chat.characterId}`,
              name: chat.character.name,
              description: chat.character.description,
              locked: true
            },
            ...(chat.persona
              ? [
                  {
                    storyId: story.id,
                    sourcePersonaId: chat.persona.id,
                    type: StoryEntityType.PERSONA,
                    canonicalKey: `persona:${chat.persona.id}`,
                    name: chat.persona.displayName,
                    description: chat.persona.summary,
                    locked: true
                  }
                ]
              : [])
          ]
        });

        if (chat.messages.length > 0) {
          await tx.storyTurn.createMany({
            data: chat.messages.map((message, index) => ({
              storyId: story.id,
              timelineId: timeline.id,
              sequence: message.sequence ?? index + 1,
              channel: message.role === MessageRole.SYSTEM ? StoryTurnChannel.SYSTEM : StoryTurnChannel.DIALOGUE,
              actorUserId: message.role === MessageRole.USER ? userId : null,
              actorCharacterId: message.role === MessageRole.ASSISTANT ? chat.characterId : null,
              sourceMessageId: message.id,
              content: message.content,
              metadata: { importedFrom: "Message" }
            }))
          });
        }

        const scene = await tx.storyScene.create({
          data: {
            storyId: story.id,
            timelineId: timeline.id,
            title: "Current scene",
            startedAtSequence: chat.messages.at(-1)?.sequence ?? chat.messages.length
          }
        });
        await tx.storyStateSnapshot.create({
          data: {
            storyId: story.id,
            timelineId: timeline.id,
            sceneId: scene.id,
            version: 0,
            state: EMPTY_WORLD_STATE
          }
        });

        const claimed = await tx.chat.updateMany({
          where: { id: chat.id, userId, storyId: null, timelineId: null },
          data: { storyId: story.id, timelineId: timeline.id }
        });
        if (claimed.count !== 1) {
          throw new StoryClaimConflict();
        }

        return { storyId: story.id, timelineId: timeline.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof StoryClaimConflict || isRetryableTransactionError(error)) {
      const claimed = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        select: { storyId: true, timelineId: true }
      });
      if (claimed?.storyId && claimed.timelineId) {
        return { storyId: claimed.storyId, timelineId: claimed.timelineId };
      }
    }
    throw error;
  }
}

export async function ensureStoryForRoom(roomId: string, userId: string) {
  const existing = await prisma.room.findFirst({
    where: { id: roomId, userId },
    select: { storyId: true, timelineId: true, timeline: { select: { isActive: true } } }
  });
  if (!existing) {
    throw new HttpError(404, "Room not found.");
  }
  if (existing.storyId && existing.timelineId) {
    if (!existing.timeline?.isActive) {
      await activateStoryTimeline(existing.storyId, existing.timelineId);
    }
    return { storyId: existing.storyId, timelineId: existing.timelineId };
  }

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findFirst({
      where: { id: roomId, userId },
      include: {
        user: { select: { name: true, username: true, email: true } },
        persona: { select: { id: true, displayName: true, summary: true } },
        characters: { orderBy: { position: "asc" }, include: { character: true } },
        messages: { orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }] }
      }
    });
    if (!room) {
      throw new HttpError(404, "Room not found.");
    }
    if (room.storyId && room.timelineId) {
      return { storyId: room.storyId, timelineId: room.timelineId };
    }

    const story = await tx.story.create({
      data: {
        ownerId: userId,
        personaId: room.personaId,
        title: room.title,
        mode: StoryMode.ENSEMBLE,
        lastActiveAt: room.lastActiveAt
      }
    });
    const timeline = await tx.storyTimeline.create({
      data: { storyId: story.id, label: "Original timeline", isActive: true }
    });

    await tx.storyParticipant.createMany({
      data: [
        {
          storyId: story.id,
          userId,
          personaId: room.personaId,
          role: StoryParticipantRole.OWNER,
          displayName: room.persona?.displayName || room.user.name || room.user.username || room.user.email
        },
        ...room.characters.map(({ character }) => ({
          storyId: story.id,
          characterId: character.id,
          role: StoryParticipantRole.CHARACTER,
          displayName: character.name
        }))
      ]
    });
    await tx.storyEntity.createMany({
      data: [
        ...room.characters.map(({ character }) => ({
          storyId: story.id,
          sourceCharacterId: character.id,
          type: StoryEntityType.CHARACTER,
          canonicalKey: `character:${character.id}`,
          name: character.name,
          description: character.description,
          locked: true
        })),
        ...(room.persona
          ? [
              {
                storyId: story.id,
                sourcePersonaId: room.persona.id,
                type: StoryEntityType.PERSONA,
                canonicalKey: `persona:${room.persona.id}`,
                name: room.persona.displayName,
                description: room.persona.summary,
                locked: true
              }
            ]
          : [])
      ]
    });
    if (room.messages.length > 0) {
      await tx.storyTurn.createMany({
        data: room.messages.map((message, index) => ({
          storyId: story.id,
          timelineId: timeline.id,
          sequence: message.sequence ?? index + 1,
          channel: message.role === RoomMessageRole.SYSTEM ? StoryTurnChannel.SYSTEM : StoryTurnChannel.DIALOGUE,
          actorUserId: message.role === RoomMessageRole.USER ? userId : null,
          actorCharacterId: message.role === RoomMessageRole.CHARACTER ? message.characterId : null,
          sourceRoomMessageId: message.id,
          content: message.content,
          metadata: { importedFrom: "RoomMessage" }
        }))
      });
    }
    const scene = await tx.storyScene.create({
      data: {
        storyId: story.id,
        timelineId: timeline.id,
        title: "Current scene",
        startedAtSequence: room.messages.at(-1)?.sequence ?? room.messages.length
      }
    });
    await tx.storyStateSnapshot.create({
      data: { storyId: story.id, timelineId: timeline.id, sceneId: scene.id, version: 0, state: EMPTY_WORLD_STATE }
    });
    await tx.room.update({
      where: { id: room.id },
      data: { storyId: story.id, timelineId: timeline.id }
    });

    return { storyId: story.id, timelineId: timeline.id };
  });
}

export async function syncChatTurns(chatId: string, userId: string) {
  const foundation = await ensureStoryForChat(chatId, userId);
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: {
      characterId: true,
      lastActiveAt: true,
      summary: true,
      messages: {
        where: { storyTurn: { is: null } },
        orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
        take: 500,
        select: {
          id: true,
          role: true,
          content: true,
          sequence: true
        }
      },
      timeline: { select: { id: true } }
    }
  });
  if (!chat?.timeline) {
    throw new HttpError(409, "Story timeline is unavailable.");
  }

  chat.messages.reverse();
  const existing = await prisma.storyTurn.findMany({
    where: {
      timelineId: foundation.timelineId,
      sourceMessageId: { in: chat.messages.map((message) => message.id) }
    },
    select: { sourceMessageId: true }
  });
  const known = new Set(existing.map((turn) => turn.sourceMessageId));
  const missing = chat.messages.filter((message) => !known.has(message.id));
  if (missing.length > 0) {
    await prisma.storyTurn.createMany({
      data: missing.map((message) => ({
        storyId: foundation.storyId,
        timelineId: foundation.timelineId,
        sequence: message.sequence ?? chat.messages.findIndex((item) => item.id === message.id) + 1,
        channel: message.role === MessageRole.SYSTEM ? StoryTurnChannel.SYSTEM : StoryTurnChannel.DIALOGUE,
        actorUserId: message.role === MessageRole.USER ? userId : null,
        actorCharacterId: message.role === MessageRole.ASSISTANT ? chat.characterId : null,
        sourceMessageId: message.id,
        content: message.content,
        metadata: { importedFrom: "Message" }
      })),
      skipDuplicates: true
    });
  }

  await prisma.story.update({
    where: { id: foundation.storyId },
    data: { lastActiveAt: chat.lastActiveAt }
  });
  await ensureAutomaticStoryCheckpoint({
    storyId: foundation.storyId,
    timelineId: foundation.timelineId,
    summary: chat.summary
  });
  return foundation;
}

export async function syncRoomTurns(roomId: string, userId: string) {
  const foundation = await ensureStoryForRoom(roomId, userId);
  const room = await prisma.room.findFirst({
    where: { id: roomId, userId },
    select: {
      lastActiveAt: true,
      summary: true,
      messages: {
        where: { storyTurn: { is: null } },
        orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
        take: 500,
        select: {
          id: true,
          role: true,
          content: true,
          sequence: true,
          characterId: true
        }
      },
      timeline: { select: { id: true } }
    }
  });
  if (!room?.timeline) {
    throw new HttpError(409, "Story timeline is unavailable.");
  }

  room.messages.reverse();
  const existing = await prisma.storyTurn.findMany({
    where: {
      timelineId: foundation.timelineId,
      sourceRoomMessageId: { in: room.messages.map((message) => message.id) }
    },
    select: { sourceRoomMessageId: true }
  });
  const known = new Set(existing.map((turn) => turn.sourceRoomMessageId));
  const missing = room.messages.filter((message) => !known.has(message.id));
  if (missing.length > 0) {
    await prisma.storyTurn.createMany({
      data: missing.map((message) => ({
        storyId: foundation.storyId,
        timelineId: foundation.timelineId,
        sequence: message.sequence ?? room.messages.findIndex((item) => item.id === message.id) + 1,
        channel: message.role === RoomMessageRole.SYSTEM ? StoryTurnChannel.SYSTEM : StoryTurnChannel.DIALOGUE,
        actorUserId: message.role === RoomMessageRole.USER ? userId : null,
        actorCharacterId: message.role === RoomMessageRole.CHARACTER ? message.characterId : null,
        sourceRoomMessageId: message.id,
        content: message.content,
        metadata: { importedFrom: "RoomMessage" }
      })),
      skipDuplicates: true
    });
  }
  await prisma.story.update({
    where: { id: foundation.storyId },
    data: { lastActiveAt: room.lastActiveAt }
  });
  await ensureAutomaticStoryCheckpoint({
    storyId: foundation.storyId,
    timelineId: foundation.timelineId,
    summary: room.summary
  });
  return foundation;
}

export async function getStoryPromptContext(input: {
  chatId: string;
  userId: string;
  actorCharacterId?: string | null;
  includeCheckpoint?: boolean;
}) {
  const foundation = await syncChatTurns(input.chatId, input.userId);
  await reconcileExplicitSceneTransition({ ...foundation, userId: input.userId });
  return buildStoryPromptContext(foundation, input.userId, input.actorCharacterId, input.includeCheckpoint);
}

export async function getRoomStoryPromptContext(input: {
  roomId: string;
  userId: string;
  actorCharacterId?: string | null;
}) {
  const foundation = await syncRoomTurns(input.roomId, input.userId);
  await reconcileExplicitSceneTransition({ ...foundation, userId: input.userId });
  return buildStoryPromptContext(foundation, input.userId, input.actorCharacterId);
}

async function buildStoryPromptContext(
  foundation: { storyId: string; timelineId: string },
  userId: string,
  actorCharacterId?: string | null,
  includeCheckpoint = true
) {
  const [story, actor] = await Promise.all([
    prisma.story.findFirst({
      where: { id: foundation.storyId, ownerId: userId },
      include: {
        facts: {
          where: {
            status: "ACTIVE",
            OR: [{ timelineId: null }, { timelineId: foundation.timelineId }]
          },
          orderBy: [{ updatedAt: "desc" }, { locked: "desc" }, { importance: "desc" }],
          take: 80,
          include: {
            subjectEntity: { select: { name: true } },
            knowledge: { select: { participantId: true, state: true } }
          }
        },
        snapshots: {
          where: { timelineId: foundation.timelineId },
          orderBy: { version: "desc" },
          take: 1
        },
        director: true,
        arcs: {
          where: { status: "ACTIVE", OR: [{ timelineId: null }, { timelineId: foundation.timelineId }] },
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          take: 8
        },
        beats: {
          where: { timelineId: foundation.timelineId, status: "READY" },
          orderBy: [{ status: "desc" }, { priority: "desc" }, { position: "asc" }],
          take: 12
        },
        hooks: {
          where: { timelineId: foundation.timelineId, status: { in: ["OPEN", "ESCALATED"] } },
          orderBy: [{ urgency: "desc" }, { updatedAt: "desc" }],
          take: 12
        },
        relationships: {
          where: { timelineId: foundation.timelineId },
          include: {
            fromParticipant: { select: { id: true, displayName: true } },
            toParticipant: { select: { id: true, displayName: true } }
          },
          orderBy: { updatedAt: "desc" },
          take: 16
        },
        proactiveEvents: {
          where: { timelineId: foundation.timelineId, status: { in: ["SCHEDULED", "READY"] } },
          include: { actorParticipant: { select: { id: true, displayName: true } } },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          take: 16
        },
        turns: {
          where: { timelineId: foundation.timelineId },
          orderBy: { sequence: "desc" },
          take: 1,
          select: { sequence: true }
        },
        participantStates: {
          where: { timelineId: foundation.timelineId },
          include: { participant: { select: { id: true, displayName: true, role: true } } },
          orderBy: { updatedAt: "desc" },
          take: 16
        },
        visualReferences: {
          where: {
            locked: true,
            OR: [{ timelineId: null }, { timelineId: foundation.timelineId }]
          },
          include: {
            participant: { select: { id: true, displayName: true, role: true } },
            entity: { select: { id: true, name: true } }
          },
          orderBy: { updatedAt: "desc" },
          take: 12
        },
        checkpoints: {
          where: { timelineId: foundation.timelineId },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        scenes: {
          where: { timelineId: foundation.timelineId },
          orderBy: { startedAtSequence: "desc" },
          take: 2
        },
        safetyProfile: true
      }
    }),
    actorCharacterId
      ? prisma.storyParticipant.findFirst({
          where: { storyId: foundation.storyId, characterId: actorCharacterId },
          select: { id: true }
        })
      : Promise.resolve(null)
  ]);

  if (!story) {
    throw new HttpError(404, "Story not found.");
  }

  const currentSequence = story.turns[0]?.sequence ?? 0;
  const applicableFacts = story.facts.filter((fact) => {
    if (fact.kind !== "STATE") return true;
    const started = fact.validFromSequence === null || fact.validFromSequence <= currentSequence;
    const notEnded = fact.validUntilSequence === null || currentSequence <= fact.validUntilSequence;
    return started && notEnded;
  }).slice(0, 24);
  const factLines = applicableFacts.map((fact, index) => {
    const subject = fact.subjectEntity?.name ? `${sanitizePromptContext(fact.subjectEntity.name, 120)} ` : "";
    const predicate = sanitizePromptContext(fact.predicate, 180);
    const objectText = sanitizePromptContext(fact.objectText, 2400);
    const lock = fact.locked ? " [CANON LOCK]" : "";
    const actorKnowledge = actor ? fact.knowledge.find((entry) => entry.participantId === actor.id)?.state : null;
    const scope = fact.scope === "OWNER"
      ? " [DIRECTOR ONLY — preserve in narration, do not reveal as character knowledge]"
      : fact.knowledge.length > 0
        ? actorKnowledge && actorKnowledge !== "FORGOTTEN"
          ? ` [ACTOR KNOWLEDGE: ${actorKnowledge}]`
          : " [NOT KNOWN BY ACTIVE CHARACTER — preserve as world truth without acting on or revealing it]"
        : ` [${fact.scope} CANON]`;
    if (fact.kind === "STATE") {
      const when = fact.worldTime ? ` recorded for ${sanitizePromptContext(fact.worldTime, 200)}` : " for the active scene";
      return `${index + 1}. ${objectText} [TEMPORARY STATE${when}; never reset time or replay an earlier scene to preserve it]${scope}${lock}`;
    }
    if (fact.kind === "EVENT") {
      const when = fact.worldTime ? ` at ${sanitizePromptContext(fact.worldTime, 200)}` : "";
      return `${index + 1}. ${objectText} [PAST EVENT${when}; preserve as history and never stage it again]${scope}${lock}`;
    }
    return `${index + 1}. ${subject}${predicate}: ${objectText} [PERMANENT CANON]${scope}${lock}`;
  });
  const now = Date.now();
  const dueEvents = story.proactiveEvents.filter((event) => {
    const belongsToActor = !event.actorParticipantId || !actor || event.actorParticipantId === actor.id;
    const dueBySequence = event.dueSequence === null || event.dueSequence <= currentSequence;
    const dueByTime = event.triggerAt === null || event.triggerAt.getTime() <= now;
    return belongsToActor && (event.status === "READY" || (dueBySequence && dueByTime));
  }).slice(0, 4);
  const relationshipLines = story.relationships
    .filter((relationship) => !actor || relationship.fromParticipantId === actor.id || relationship.toParticipantId === actor.id)
    .map((relationship) => {
      const label = relationship.label ? ` (${relationship.label})` : "";
      const notes = relationship.notes ? `; ${sanitizePromptContext(relationship.notes, 300)}` : "";
      return `- ${relationship.fromParticipant.displayName} -> ${relationship.toParticipant.displayName}${label}: trust ${relationship.trust}, affection ${relationship.affection}, tension ${relationship.tension}, respect ${relationship.respect}${notes}`;
    });
  const director = story.director;
  const participantStateLines = story.participantStates
    .filter((state) =>
      !actor ||
      state.participantId === actor.id ||
      state.participant.role === "PLAYER" ||
      state.participant.role === "OWNER"
    )
    .map((state) => {
      const details = [
        state.displayNameOverride ? `name ${state.displayNameOverride}` : null,
        state.pronouns ? `pronouns ${state.pronouns}` : null,
        state.currentMood ? `mood ${state.currentMood}` : null,
        state.appearance ? `appearance ${sanitizePromptContext(state.appearance, 400)}` : null,
        state.currentGoal ? `goal ${sanitizePromptContext(state.currentGoal, 400)}` : null,
        state.innerConflict ? `inner conflict ${sanitizePromptContext(state.innerConflict, 400)}` : null,
        state.voiceStyle ? `voice ${state.voiceStyle}` : null,
        state.speakingStyle ? `speech ${sanitizePromptContext(state.speakingStyle, 400)}` : null
      ].filter(Boolean);
      return `- ${state.participant.displayName}: ${details.join("; ")}`;
    });
  const visualLines = story.visualReferences
    .filter((reference) =>
      !actor ||
      !reference.participantId ||
      reference.participantId === actor.id ||
      reference.participant?.role === "PLAYER" ||
      reference.participant?.role === "OWNER"
    )
    .map((reference) => `- [${reference.kind}] ${reference.participant?.displayName ?? reference.entity?.name ?? "Story"} / ${reference.title}: ${sanitizePromptContext(reference.prompt || reference.notes || "Locked visual continuity reference.", 500)}`);
  const checkpoint = story.checkpoints[0];
  const safety = story.safetyProfile;
  const world = story.snapshots[0]?.state ?? EMPTY_WORLD_STATE;
  const activeScene = story.scenes.find((scene) => scene.status === "ACTIVE") ?? story.scenes[0];
  const text = [
    "SESSION SAFETY (AUTHORITATIVE)",
    safety
      ? [
          `Content rating: ${safety.contentRating}. Session ${safety.paused ? "PAUSED — do not advance the fiction; respond out of character and wait for explicit resume" : "active"}.`,
          `Hard limits (never include): ${safety.hardLimits.join("; ") || "none recorded"}.`,
          `Soft limits (approach carefully and invite control): ${safety.softLimits.join("; ") || "none recorded"}.`,
          `Fade to black instead of depicting: ${safety.fadeToBlack.join("; ") || "none recorded"}.`,
          safety.checkInInterval > 0
            ? (currentSequence > 0 && currentSequence % safety.checkInInterval === 0
                ? "A safety check-in is due now. Pause before advancing and ask a brief out-of-character check-in."
                : `Ask a brief out-of-character safety check-in every ${safety.checkInInterval} turns.`)
            : "Periodic safety check-ins are disabled.",
          safety.notes ? `Safety notes: ${sanitizePromptContext(safety.notes, 900)}` : ""
        ].filter(Boolean).join("\n")
      : "No story-specific safety profile exists. Continue to obey platform safety and the active persona boundaries.",
    "",
    "STORY CANON (AUTHORITATIVE)",
    "Permanent canon is binding world truth. Temporary states apply only to the active scene and their recorded time. Past events are history, not instructions to recreate them. Newer turns override stale temporary state. Respect knowledge labels without making the active character reveal or act on unknown facts.",
    factLines.length > 0 ? factLines.join("\n") : "No structured canon facts have been recorded yet.",
    "",
    "CURRENT WORLD STATE",
    activeScene
      ? `Active scene: ${sanitizePromptContext(activeScene.title || "Untitled scene", 160)}; in-world time: ${sanitizePromptContext(activeScene.worldTime || "not specified", 200)}; location: ${sanitizePromptContext(activeScene.location || "not specified", 240)}.`
      : "No explicit active scene is recorded.",
    "Treat this as a continuity snapshot, not a command to repeat its opening beat. If recent turns establish a later time, day, or location, continue from the newer turn and never rewind to this snapshot.",
    sanitizePromptContext(JSON.stringify(world), 2200),
    "",
    "NARRATIVE DIRECTOR",
    director
      ? `Tone: ${director.tone || "adaptive"}; pacing: ${director.pacing}; initiative: ${director.initiative}; conflict ${director.conflictLevel}/10; romance ${director.romanceLevel}/10; mystery ${director.mysteryLevel}/10; humor ${director.humorLevel}/10; offscreen events ${director.allowOffscreenEvents ? "allowed" : "disabled"}.\nRomance direction: ${romanceLevelInstruction(director.romanceLevel)}\n${director.notes ? `Private direction: ${sanitizePromptContext(director.notes, 900)}` : ""}`
      : "Balanced pacing and initiative. Preserve player agency.",
    "",
    "ACTIVE STORY ARCS",
    story.arcs.length > 0
      ? story.arcs.map((arc) => `- ${arc.title} (${arc.progress}%): ${sanitizePromptContext(arc.premise, 500)}`).join("\n")
      : "No explicit arc is active; follow the current scene and character goals.",
    "",
    "NEXT STORY BEATS",
    story.beats.length > 0
      ? story.beats.slice(0, 4).map((beat) => `- One-shot opportunity — advance toward it without replaying an earlier setup: ${beat.title}: ${sanitizePromptContext(beat.description, 500)}`).join("\n")
      : "No beat is prescribed. Advance naturally without forcing a twist.",
    "",
    "OPEN HOOKS",
    story.hooks.length > 0
      ? story.hooks.slice(0, 8).map((hook) => `- ${hook.title} (urgency ${hook.urgency}/10${hook.directorOnly ? ", private" : ""}): ${sanitizePromptContext(hook.description, 420)}`).join("\n")
      : "No unresolved hooks are recorded.",
    "",
    "RELATIONSHIP STATE",
    relationshipLines.length > 0 ? relationshipLines.join("\n") : "No explicit relationship meters are recorded.",
    "",
    "DUE PROACTIVE EVENTS",
    dueEvents.length > 0
      ? dueEvents.map((event) => `- ${event.actorParticipant?.displayName ?? "The story"} / ${event.channel}: ${sanitizePromptContext(event.instruction, 600)}`).join("\n")
      : "No scheduled initiative is due this turn.",
    "",
    "DYNAMIC PARTICIPANT STATE",
    participantStateLines.length > 0 ? participantStateLines.join("\n") : "No participant state overrides are active.",
    "",
    "LOCKED VISUAL CONTINUITY",
    visualLines.length > 0 ? visualLines.join("\n") : "No locked visual references are active.",
    "",
    "LATEST CONTINUITY CHECKPOINT",
    includeCheckpoint && checkpoint
      ? `${checkpoint.title}: ${sanitizePromptContext(checkpoint.summary, 1800)}\nOpen threads: ${checkpoint.openThreads.join("; ") || "none recorded"}`
      : includeCheckpoint
        ? "No checkpoint exists yet; rely on canon, world state, and recent turns."
        : "Checkpoint omitted because the user selected an earlier response branch; rely on the selected recent turns."
  ].join("\n");

  const factualParticipantStateLines = story.participantStates
    .filter((state) => !actor || state.participantId === actor.id)
    .map((state) => {
      const details = [
        state.displayNameOverride ? `name ${state.displayNameOverride}` : null,
        state.pronouns ? `pronouns ${state.pronouns}` : null,
        state.currentMood ? `mood ${state.currentMood}` : null,
        state.appearance ? `appearance ${sanitizePromptContext(state.appearance, 400)}` : null,
        state.currentGoal ? `goal ${sanitizePromptContext(state.currentGoal, 400)}` : null,
        state.innerConflict ? `inner conflict ${sanitizePromptContext(state.innerConflict, 400)}` : null
      ].filter(Boolean);
      return `- ${state.participant.displayName}: ${details.join("; ")}`;
    });
  const factualText = [
    "STORY SAFETY SETTINGS (FACTUAL CONTEXT)",
    safety
      ? [
          `Content rating: ${safety.contentRating}.`,
          `Session paused: ${safety.paused ? "yes" : "no"}.`,
          `Hard limits: ${safety.hardLimits.join("; ") || "none recorded"}.`,
          `Soft limits: ${safety.softLimits.join("; ") || "none recorded"}.`,
          `Fade-to-black topics: ${safety.fadeToBlack.join("; ") || "none recorded"}.`,
          safety.notes ? `Safety notes: ${sanitizePromptContext(safety.notes, 900)}` : null
        ].filter(Boolean).join("\n")
      : "No story-specific safety settings are recorded.",
    "",
    "STORY CANON (FACTUAL CONTEXT)",
    factLines.length > 0 ? factLines.join("\n") : "No structured canon facts have been recorded yet.",
    "",
    "CURRENT WORLD STATE (FACTUAL CONTEXT)",
    sanitizePromptContext(JSON.stringify(world), 2200),
    "",
    "ACTIVE STORY ARCS (FACTUAL CONTEXT)",
    story.arcs.length > 0
      ? story.arcs.map((arc) => `- ${arc.title} (${arc.progress}%): ${sanitizePromptContext(arc.premise, 500)}`).join("\n")
      : "No explicit arc is active.",
    "",
    "OPEN STORY HOOKS (FACTUAL CONTEXT)",
    story.hooks.length > 0
      ? story.hooks.slice(0, 8).map((hook) => `- ${hook.title}: ${sanitizePromptContext(hook.description, 420)}`).join("\n")
      : "No unresolved hooks are recorded.",
    "",
    "RELATIONSHIP STATE (FACTUAL CONTEXT)",
    relationshipLines.length > 0 ? relationshipLines.join("\n") : "No explicit relationship meters are recorded.",
    "",
    "DYNAMIC PARTICIPANT STATE (FACTUAL CONTEXT)",
    factualParticipantStateLines.length > 0 ? factualParticipantStateLines.join("\n") : "No participant state overrides are active.",
    "",
    "LOCKED VISUAL CONTINUITY (FACTUAL CONTEXT)",
    visualLines.length > 0 ? visualLines.join("\n") : "No locked visual references are active.",
    "",
    "LATEST CONTINUITY CHECKPOINT (FACTUAL CONTEXT)",
    includeCheckpoint && checkpoint
      ? `${checkpoint.title}: ${sanitizePromptContext(checkpoint.summary, 1800)}\nOpen threads: ${checkpoint.openThreads.join("; ") || "none recorded"}`
      : "No applicable checkpoint is included."
  ].join("\n");

  return { ...foundation, text, factualText, eventIds: dueEvents.map((event) => event.id), beatIds: story.beats.slice(0, 4).map((beat) => beat.id) };
}

class StoryClaimConflict extends Error {}

async function activateStoryTimeline(storyId: string, timelineId: string) {
  await prisma.$transaction([
    prisma.storyTimeline.updateMany({
      where: { storyId, isActive: true, id: { not: timelineId } },
      data: { isActive: false }
    }),
    prisma.storyTimeline.update({ where: { id: timelineId }, data: { isActive: true } })
  ]);
}

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
