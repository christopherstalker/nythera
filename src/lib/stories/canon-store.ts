import "server-only";

import {
  Prisma,
  StoryFactScope,
  StoryFactStatus,
  StoryKnowledgeState
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
  const [facts, snapshot] = await Promise.all([
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
      : Promise.resolve(null)
  ]);

  return { story, timeline, facts, snapshot };
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

  return prisma.$transaction(async (tx) => {
    if (input.subjectEntityId || !/^is (?:not )?true now$/i.test(input.predicate)) {
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
    const updatedStory = await tx.story.update({
      where: { id: input.storyId },
      data: { stateVersion: { increment: 1 }, lastActiveAt: new Date() },
      select: { stateVersion: true }
    });
    return tx.storyStateSnapshot.create({
      data: {
        storyId: input.storyId,
        timelineId,
        version: updatedStory.stateVersion,
        state: input.state
      }
    });
  });
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
