import "server-only";

import {
  Prisma,
  StoryFactKind,
  StoryFactScope,
  StoryFactStatus,
  StoryKnowledgeState,
  StorySceneStatus
} from "@prisma/client";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export type StoryFactCreateInput = {
  timelineId?: string | null;
  subjectEntityId?: string | null;
  objectEntityId?: string | null;
  sourceMessageId?: string | null;
  predicate: string;
  objectText: string;
  kind: StoryFactKind;
  worldTime?: string | null;
  validFromSequence?: number | null;
  validUntilSequence?: number | null;
  scope: StoryFactScope;
  confidence: number;
  importance: number;
  locked: boolean;
  participantIds: string[];
};

export type StoryFactUpdateInput = {
  subjectEntityId?: string | null;
  objectEntityId?: string | null;
  predicate?: string;
  objectText?: string;
  kind?: StoryFactKind;
  worldTime?: string | null;
  validFromSequence?: number | null;
  validUntilSequence?: number | null;
  scope?: StoryFactScope;
  confidence?: number;
  importance?: number;
  locked?: boolean;
  status?: StoryFactStatus;
  participantIds?: string[];
  knowledgeState?: StoryKnowledgeState;
};

export async function getStoryCodex(storyId: string, userId: string, timelineId?: string | null) {
  const story = await assertStoryAccess(storyId, userId);
  const timeline = (timelineId ? story.timelines.find((item) => item.id === timelineId) : null)
    ?? story.timelines.find((item) => item.isActive)
    ?? story.timelines[0]
    ?? null;
  const [facts, snapshot, scenes, latestTurn] = await Promise.all([
    prisma.storyFact.findMany({
      where: {
        storyId,
        status: StoryFactStatus.ACTIVE,
        ...(timeline ? { OR: [{ timelineId: null }, { timelineId: timeline.id }] } : {})
      },
      orderBy: [{ locked: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
      include: {
        subjectEntity: { select: { id: true, name: true, type: true } },
        objectEntity: { select: { id: true, name: true, type: true } },
        sourceTurn: { select: { id: true, sequence: true, content: true } },
        sourceMessage: { select: { id: true, content: true, createdAt: true } },
        knowledge: {
          include: {
            participant: { select: { id: true, displayName: true, role: true, characterId: true } }
          }
        }
      }
    }),
    timeline
      ? prisma.storyStateSnapshot.findFirst({
          where: { storyId, timelineId: timeline.id },
          orderBy: { version: "desc" }
        })
      : Promise.resolve(null),
    timeline
      ? prisma.storyScene.findMany({
          where: { storyId, timelineId: timeline.id },
          orderBy: [{ status: "asc" }, { startedAtSequence: "desc" }],
          take: 8
        })
      : Promise.resolve([]),
    timeline
      ? prisma.storyTurn.findFirst({
          where: { storyId, timelineId: timeline.id },
          orderBy: { sequence: "desc" },
          select: { sequence: true }
        })
      : Promise.resolve(null)
  ]);

  return {
    story,
    timeline,
    facts,
    snapshot,
    scenes,
    activeScene: scenes.find((scene) => scene.status === StorySceneStatus.ACTIVE) ?? null,
    currentSequence: latestTurn?.sequence ?? 0
  };
}

export async function createStoryFact(storyId: string, userId: string, input: StoryFactCreateInput) {
  const story = await assertStoryAccess(storyId, userId, true);
  const timelineId = input.timelineId ?? story.timelines.find((item) => item.isActive)?.id ?? story.timelines[0]?.id;
  if (!timelineId) {
    throw new HttpError(409, "Story timeline is unavailable.");
  }

  await assertFactReferences(storyId, userId, {
    timelineId,
    subjectEntityId: input.subjectEntityId,
    objectEntityId: input.objectEntityId,
    sourceMessageId: input.sourceMessageId,
    participantIds: input.participantIds
  });

  const latestTurn = await prisma.storyTurn.findFirst({
    where: { storyId, timelineId },
    orderBy: { sequence: "desc" },
    select: { sequence: true }
  });
  const validFromSequence = input.kind === StoryFactKind.STATE
    ? input.validFromSequence ?? latestTurn?.sequence ?? 0
    : input.validFromSequence;

  return prisma.$transaction(async (tx) => {
    if (input.kind === StoryFactKind.PERMANENT) {
      const contradiction = await tx.storyFact.findFirst({
        where: {
          storyId,
          timelineId,
          subjectEntityId: input.subjectEntityId ?? null,
          predicate: input.predicate,
          locked: true,
          status: StoryFactStatus.ACTIVE,
          NOT: { objectText: { equals: input.objectText, mode: "insensitive" } }
        },
        select: { objectText: true }
      });
      if (contradiction) {
        throw new HttpError(409, `Canon contradiction detected. Locked fact says: ${contradiction.objectText}`);
      }
    }
    const existing = await tx.storyFact.findFirst({
      where: {
        storyId,
        timelineId,
        subjectEntityId: input.subjectEntityId ?? null,
        predicate: input.predicate,
        objectText: input.objectText,
        kind: input.kind,
        worldTime: input.worldTime ?? null,
        status: StoryFactStatus.ACTIVE
      }
    });

    const fact = existing
      ? await tx.storyFact.update({
          where: { id: existing.id },
          data: {
            locked: existing.locked || input.locked,
            importance: Math.max(existing.importance, input.importance),
            confidence: Math.max(existing.confidence, input.confidence),
            scope: input.scope,
            objectEntityId: input.objectEntityId,
            worldTime: input.worldTime,
            validFromSequence,
            validUntilSequence: input.validUntilSequence,
            sourceMessageId: input.sourceMessageId ?? existing.sourceMessageId
          }
        })
      : await tx.storyFact.create({
          data: {
            storyId,
            timelineId,
            subjectEntityId: input.subjectEntityId,
            objectEntityId: input.objectEntityId,
            sourceMessageId: input.sourceMessageId,
            predicate: input.predicate,
            objectText: input.objectText,
            kind: input.kind,
            worldTime: input.worldTime,
            validFromSequence,
            validUntilSequence: input.validUntilSequence,
            scope: input.scope,
            confidence: input.confidence,
            importance: input.importance,
            locked: input.locked,
            metadata: { source: "manual" }
          }
        });

    if (input.participantIds.length > 0) {
      await tx.storyKnowledge.createMany({
        data: input.participantIds.map((participantId) => ({
          factId: fact.id,
          participantId,
          state: StoryKnowledgeState.KNOWN
        })),
        skipDuplicates: true
      });
    }

    return tx.storyFact.findUniqueOrThrow({
      where: { id: fact.id },
      include: {
        subjectEntity: { select: { id: true, name: true, type: true } },
        knowledge: {
          include: { participant: { select: { id: true, displayName: true, role: true } } }
        }
      }
    });
  });
}

export async function updateStoryFact(storyId: string, factId: string, userId: string, input: StoryFactUpdateInput) {
  await assertStoryAccess(storyId, userId, true);
  const existing = await prisma.storyFact.findFirst({ where: { id: factId, storyId } });
  if (!existing) {
    throw new HttpError(404, "Canon fact not found.");
  }

  await assertFactReferences(storyId, userId, {
    subjectEntityId: input.subjectEntityId,
    objectEntityId: input.objectEntityId,
    participantIds: input.participantIds
  });

  return prisma.$transaction(async (tx) => {
    const fact = await tx.storyFact.update({
      where: { id: factId },
      data: {
        subjectEntityId: input.subjectEntityId,
        objectEntityId: input.objectEntityId,
        predicate: input.predicate,
        objectText: input.objectText,
        kind: input.kind,
        worldTime: input.worldTime,
        validFromSequence: input.validFromSequence,
        validUntilSequence: input.validUntilSequence,
        scope: input.scope,
        confidence: input.confidence,
        importance: input.importance,
        locked: input.locked,
        status: input.status
      }
    });

    if (input.participantIds) {
      await tx.storyKnowledge.deleteMany({ where: { factId } });
      if (input.participantIds.length > 0) {
        await tx.storyKnowledge.createMany({
          data: input.participantIds.map((participantId) => ({
            factId,
            participantId,
            state: input.knowledgeState ?? StoryKnowledgeState.KNOWN
          }))
        });
      }
    }

    return fact;
  });
}

export async function updateStoryState(input: {
  storyId: string;
  userId: string;
  state: Prisma.InputJsonObject;
}) {
  const story = await assertStoryAccess(input.storyId, input.userId, true);
  const timelineId = story.timelines.find((item) => item.isActive)?.id ?? story.timelines[0]?.id;
  if (!timelineId) {
    throw new HttpError(409, "Story timeline is unavailable.");
  }

  return prisma.$transaction(async (tx) => {
    const activeScene = await ensureActiveScene(tx, input.storyId, timelineId);
    const state = asWorldState(input.state);
    await tx.storyScene.update({
      where: { id: activeScene.id },
      data: {
        title: state.sceneTitle || activeScene.title,
        worldTime: state.time,
        location: state.location
      }
    });
    const updatedStory = await tx.story.update({
      where: { id: input.storyId },
      data: { stateVersion: { increment: 1 }, lastActiveAt: new Date() },
      select: { stateVersion: true }
    });
    return tx.storyStateSnapshot.create({
      data: {
        storyId: input.storyId,
        timelineId,
        sceneId: activeScene.id,
        version: updatedStory.stateVersion,
        state: input.state
      }
    });
  });
}

export async function advanceStoryScene(input: {
  storyId: string;
  userId: string;
  state: Prisma.InputJsonObject;
  previousSceneSummary?: string | null;
  carryInventory: boolean;
}) {
  const story = await assertStoryAccess(input.storyId, input.userId, true);
  const timelineId = story.timelines.find((item) => item.isActive)?.id ?? story.timelines[0]?.id;
  if (!timelineId) {
    throw new HttpError(409, "Story timeline is unavailable.");
  }

  return prisma.$transaction(async (tx) => {
    const [activeScene, latestTurn, latestSnapshot] = await Promise.all([
      ensureActiveScene(tx, input.storyId, timelineId),
      tx.storyTurn.findFirst({ where: { storyId: input.storyId, timelineId }, orderBy: { sequence: "desc" }, select: { sequence: true } }),
      tx.storyStateSnapshot.findFirst({ where: { storyId: input.storyId, timelineId }, orderBy: { version: "desc" }, select: { state: true } })
    ]);
    const currentSequence = latestTurn?.sequence ?? 0;
    const previousState = asWorldState(latestSnapshot?.state);
    const requestedState = asWorldState(input.state);
    const nextState: Prisma.InputJsonObject = {
      ...requestedState,
      inventory: input.carryInventory ? previousState.inventory : requestedState.inventory,
      conditions: [],
      threats: [],
      notes: []
    };

    await tx.storyScene.updateMany({
      where: { storyId: input.storyId, timelineId, status: StorySceneStatus.CLOSED },
      data: { status: StorySceneStatus.ARCHIVED }
    });
    await tx.storyScene.update({
      where: { id: activeScene.id },
      data: {
        status: StorySceneStatus.CLOSED,
        endedAtSequence: currentSequence,
        summary: input.previousSceneSummary || null
      }
    });
    await tx.storyFact.updateMany({
      where: {
        storyId: input.storyId,
        timelineId,
        kind: StoryFactKind.STATE,
        status: StoryFactStatus.ACTIVE,
        validUntilSequence: null
      },
      data: { validUntilSequence: currentSequence }
    });

    const scene = await tx.storyScene.create({
      data: {
        storyId: input.storyId,
        timelineId,
        status: StorySceneStatus.ACTIVE,
        title: typeof requestedState.sceneTitle === "string" ? requestedState.sceneTitle : "Current scene",
        worldTime: typeof requestedState.time === "string" ? requestedState.time : null,
        location: typeof requestedState.location === "string" ? requestedState.location : null,
        startedAtSequence: currentSequence + 1
      }
    });
    const updatedStory = await tx.story.update({
      where: { id: input.storyId },
      data: { stateVersion: { increment: 1 }, lastActiveAt: new Date() },
      select: { stateVersion: true }
    });
    const snapshot = await tx.storyStateSnapshot.create({
      data: {
        storyId: input.storyId,
        timelineId,
        sceneId: scene.id,
        version: updatedStory.stateVersion,
        state: nextState
      }
    });

    return { scene, snapshot };
  });
}

export async function reconcileExplicitSceneTransition(input: {
  storyId: string;
  timelineId: string;
  userId: string;
}) {
  const [activeScene, recentTurns, latestSnapshot] = await Promise.all([
    prisma.storyScene.findFirst({
      where: { storyId: input.storyId, timelineId: input.timelineId, status: StorySceneStatus.ACTIVE },
      orderBy: { startedAtSequence: "desc" }
    }),
    prisma.storyTurn.findMany({
      where: { storyId: input.storyId, timelineId: input.timelineId },
      orderBy: { sequence: "desc" },
      take: 4,
      select: { sequence: true, content: true }
    }),
    prisma.storyStateSnapshot.findFirst({
      where: { storyId: input.storyId, timelineId: input.timelineId },
      orderBy: { version: "desc" },
      select: { state: true }
    })
  ]);
  const transition = recentTurns
    .map((turn) => ({ turn, label: explicitSceneTransition(turn.content) }))
    .find((candidate) => candidate.label && (activeScene?.startedAtSequence ?? -1) <= candidate.turn.sequence);
  if (!transition?.label || (activeScene?.startedAtSequence ?? -1) > transition.turn.sequence) return false;

  const state = asWorldState(latestSnapshot?.state);
  await advanceStoryScene({
    storyId: input.storyId,
    userId: input.userId,
    carryInventory: true,
    state: {
      ...state,
      sceneTitle: `After ${transition.label}`,
      time: transition.label
    }
  });
  return true;
}

async function ensureActiveScene(tx: Prisma.TransactionClient, storyId: string, timelineId: string) {
  const existing = await tx.storyScene.findFirst({
    where: { storyId, timelineId, status: StorySceneStatus.ACTIVE },
    orderBy: { startedAtSequence: "desc" }
  });
  if (existing) return existing;

  const latestTurn = await tx.storyTurn.findFirst({
    where: { storyId, timelineId },
    orderBy: { sequence: "desc" },
    select: { sequence: true }
  });
  return tx.storyScene.create({
    data: {
      storyId,
      timelineId,
      status: StorySceneStatus.ACTIVE,
      title: "Current scene",
      startedAtSequence: latestTurn?.sequence ?? 0
    }
  });
}

function asWorldState(value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined) {
  const state = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    sceneTitle: typeof state.sceneTitle === "string" ? state.sceneTitle : null,
    time: typeof state.time === "string" ? state.time : null,
    location: typeof state.location === "string" ? state.location : null,
    weather: typeof state.weather === "string" ? state.weather : null,
    inventory: Array.isArray(state.inventory) ? state.inventory.filter((item): item is string => typeof item === "string") : [],
    conditions: Array.isArray(state.conditions) ? state.conditions.filter((item): item is string => typeof item === "string") : [],
    threats: Array.isArray(state.threats) ? state.threats.filter((item): item is string => typeof item === "string") : [],
    notes: Array.isArray(state.notes) ? state.notes.filter((item): item is string => typeof item === "string") : []
  };
}

function explicitSceneTransition(value: string) {
  const normalized = value.replace(/^\s*(?:[*_>#-]+\s*)+/, "").trimStart();
  const match = normalized.match(/^(?:(?:the\s+)?(?:next|following)\s+(?:morning|afternoon|evening|night|day|week|month|year)|(?:a few|several|\d+|one|two|three|four|five)\s+(?:hours?|days?|weeks?|months?|years?)\s+later|later\s+that\s+(?:day|night|morning|evening)|by\s+(?:morning|noon|evening|midnight))\b/i);
  return match?.[0] ?? null;
}

async function assertStoryAccess(storyId: string, userId: string, ownerOnly = false) {
  const story = await prisma.story.findFirst({
    where: {
      id: storyId,
      ...(ownerOnly
        ? { ownerId: userId }
        : { OR: [{ ownerId: userId }, { participants: { some: { userId } } }] })
    },
    include: {
      timelines: { orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          userId: true,
          characterId: true,
          personaId: true,
          role: true,
          displayName: true
        }
      },
      entities: {
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: {
          id: true,
          type: true,
          canonicalKey: true,
          name: true,
          description: true,
          locked: true,
          sourceCharacterId: true,
          sourcePersonaId: true
        }
      }
    }
  });
  if (!story) {
    throw new HttpError(404, "Story not found.");
  }
  return story;
}

async function assertFactReferences(
  storyId: string,
  userId: string,
  input: {
    timelineId?: string | null;
    subjectEntityId?: string | null;
    objectEntityId?: string | null;
    sourceMessageId?: string | null;
    participantIds?: string[];
  }
) {
  const [timelineCount, entityCount, participantCount, sourceCount] = await Promise.all([
    input.timelineId ? prisma.storyTimeline.count({ where: { id: input.timelineId, storyId } }) : Promise.resolve(1),
    input.subjectEntityId || input.objectEntityId
      ? prisma.storyEntity.count({
          where: { storyId, id: { in: [input.subjectEntityId, input.objectEntityId].filter(Boolean) as string[] } }
        })
      : Promise.resolve(0),
    input.participantIds?.length
      ? prisma.storyParticipant.count({ where: { storyId, id: { in: input.participantIds } } })
      : Promise.resolve(0),
    input.sourceMessageId
      ? prisma.message.count({ where: { id: input.sourceMessageId, chat: { userId, storyId } } })
      : Promise.resolve(1)
  ]);

  const expectedEntities = new Set([input.subjectEntityId, input.objectEntityId].filter(Boolean)).size;
  if (timelineCount !== 1 || entityCount !== expectedEntities || participantCount !== (input.participantIds?.length ?? 0) || sourceCount !== 1) {
    throw new HttpError(400, "One or more canon references do not belong to this story.");
  }
}
