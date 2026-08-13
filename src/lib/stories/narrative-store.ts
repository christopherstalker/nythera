import "server-only";

import {
  StoryArcStatus,
  StoryBeatStatus,
  StoryHookStatus,
  StoryInitiative,
  StoryPacing,
  StoryProactiveStatus,
  StoryTurnChannel
} from "@prisma/client";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const defaultStoryDirector = {
  tone: null,
  pacing: StoryPacing.BALANCED,
  initiative: StoryInitiative.BALANCED,
  conflictLevel: 5,
  romanceLevel: 3,
  mysteryLevel: 5,
  humorLevel: 3,
  allowOffscreenEvents: true,
  notes: null
};

export async function getStoryNarrative(storyId: string, userId: string, requestedTimelineId?: string | null) {
  const context = await resolveOwnedNarrativeContext(storyId, userId, requestedTimelineId);
  const [director, arcs, beats, hooks, relationships, proactiveEvents, turnAggregate] = await Promise.all([
    prisma.storyDirectorProfile.findUnique({ where: { storyId } }),
    prisma.storyArc.findMany({
      where: { storyId, OR: [{ timelineId: null }, { timelineId: context.timelineId }] },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.storyBeat.findMany({
      where: { storyId, timelineId: context.timelineId },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { position: "asc" }, { createdAt: "asc" }]
    }),
    prisma.storyHook.findMany({
      where: { storyId, timelineId: context.timelineId },
      orderBy: [{ status: "asc" }, { urgency: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.storyRelationshipState.findMany({
      where: { storyId, timelineId: context.timelineId },
      orderBy: { updatedAt: "desc" },
      include: {
        fromParticipant: { select: { id: true, displayName: true, role: true } },
        toParticipant: { select: { id: true, displayName: true, role: true } },
        revisions: { orderBy: { createdAt: "desc" }, take: 12 }
      }
    }),
    prisma.storyProactiveEvent.findMany({
      where: { storyId, timelineId: context.timelineId },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueSequence: "asc" }, { createdAt: "desc" }],
      include: { actorParticipant: { select: { id: true, displayName: true, role: true } } }
    }),
    prisma.storyTurn.aggregate({ where: { timelineId: context.timelineId }, _max: { sequence: true } })
  ]);

  return {
    timeline: context.timeline,
    currentSequence: turnAggregate._max.sequence ?? 0,
    director: director ?? defaultStoryDirector,
    participants: context.participants,
    arcs,
    beats,
    hooks,
    relationships,
    proactiveEvents
  };
}

export async function updateStoryDirector(storyId: string, userId: string, input: {
  tone: string | null;
  pacing: StoryPacing;
  initiative: StoryInitiative;
  conflictLevel: number;
  romanceLevel: number;
  mysteryLevel: number;
  humorLevel: number;
  allowOffscreenEvents: boolean;
  notes: string | null;
}) {
  await resolveOwnedNarrativeContext(storyId, userId);
  return prisma.storyDirectorProfile.upsert({
    where: { storyId },
    create: { storyId, ...input },
    update: input
  });
}

export async function createStoryArc(storyId: string, userId: string, input: {
  timelineId?: string | null;
  title: string;
  premise: string;
  priority: number;
  targetBeatCount?: number | null;
}) {
  const context = await resolveOwnedNarrativeContext(storyId, userId, input.timelineId);
  return prisma.storyArc.create({
    data: {
      storyId,
      timelineId: input.timelineId === null ? null : context.timelineId,
      title: input.title,
      premise: input.premise,
      priority: input.priority,
      targetBeatCount: input.targetBeatCount
    }
  });
}

export async function createStoryBeat(storyId: string, userId: string, input: {
  timelineId?: string | null;
  arcId?: string | null;
  title: string;
  description: string;
  status: StoryBeatStatus;
  position: number;
  priority: number;
}) {
  const context = await resolveOwnedNarrativeContext(storyId, userId, input.timelineId);
  await assertArcBelongsToStory(input.arcId, storyId);
  return prisma.storyBeat.create({
    data: {
      storyId,
      timelineId: context.timelineId,
      arcId: input.arcId,
      title: input.title,
      description: input.description,
      status: input.status,
      position: input.position,
      priority: input.priority
    }
  });
}

export async function createStoryHook(storyId: string, userId: string, input: {
  timelineId?: string | null;
  arcId?: string | null;
  title: string;
  description: string;
  payoff?: string | null;
  urgency: number;
  directorOnly: boolean;
  dueSequence?: number | null;
}) {
  const context = await resolveOwnedNarrativeContext(storyId, userId, input.timelineId);
  await assertArcBelongsToStory(input.arcId, storyId);
  return prisma.storyHook.create({
    data: {
      storyId,
      timelineId: context.timelineId,
      arcId: input.arcId,
      title: input.title,
      description: input.description,
      payoff: input.payoff,
      urgency: input.urgency,
      directorOnly: input.directorOnly,
      dueSequence: input.dueSequence
    }
  });
}

export async function upsertStoryRelationship(storyId: string, userId: string, input: {
  timelineId?: string | null;
  fromParticipantId: string;
  toParticipantId: string;
  label?: string | null;
  trust: number;
  affection: number;
  tension: number;
  respect: number;
  notes?: string | null;
}) {
  if (input.fromParticipantId === input.toParticipantId) {
    throw new HttpError(400, "A relationship requires two different participants.");
  }
  const context = await resolveOwnedNarrativeContext(storyId, userId, input.timelineId);
  assertParticipantsBelongToStory(context.participants, [input.fromParticipantId, input.toParticipantId]);
  const relationship = await prisma.storyRelationshipState.upsert({
    where: {
      timelineId_fromParticipantId_toParticipantId: {
        timelineId: context.timelineId,
        fromParticipantId: input.fromParticipantId,
        toParticipantId: input.toParticipantId
      }
    },
    create: {
      storyId,
      timelineId: context.timelineId,
      fromParticipantId: input.fromParticipantId,
      toParticipantId: input.toParticipantId,
      label: input.label,
      trust: input.trust,
      affection: input.affection,
      tension: input.tension,
      respect: input.respect,
      notes: input.notes
    },
    update: {
      label: input.label,
      trust: input.trust,
      affection: input.affection,
      tension: input.tension,
      respect: input.respect,
      notes: input.notes,
      version: { increment: 1 }
    }
  });
  await prisma.storyRelationshipRevision.create({ data: { relationshipId: relationship.id, label: relationship.label, trust: relationship.trust, affection: relationship.affection, tension: relationship.tension, respect: relationship.respect, notes: relationship.notes } });
  return relationship;
}

export async function createStoryProactiveEvent(storyId: string, userId: string, input: {
  timelineId?: string | null;
  actorParticipantId?: string | null;
  title: string;
  instruction: string;
  channel: StoryTurnChannel;
  priority: number;
  afterTurns: number;
  triggerAt?: Date | null;
}) {
  const context = await resolveOwnedNarrativeContext(storyId, userId, input.timelineId);
  if (input.actorParticipantId) {
    assertParticipantsBelongToStory(context.participants, [input.actorParticipantId]);
  }
  const latestTurn = await prisma.storyTurn.findFirst({
    where: { timelineId: context.timelineId },
    orderBy: { sequence: "desc" },
    select: { id: true, sequence: true }
  });
  return prisma.storyProactiveEvent.create({
    data: {
      storyId,
      timelineId: context.timelineId,
      actorParticipantId: input.actorParticipantId,
      createdByTurnId: latestTurn?.id,
      title: input.title,
      instruction: input.instruction,
      channel: input.channel,
      priority: input.priority,
      dueSequence: (latestTurn?.sequence ?? 0) + input.afterTurns,
      triggerAt: input.triggerAt,
      status: input.afterTurns === 0 && !input.triggerAt ? StoryProactiveStatus.READY : StoryProactiveStatus.SCHEDULED
    }
  });
}

export async function updateStoryNarrativeItem(storyId: string, userId: string, input: {
  kind: "arc" | "beat" | "hook" | "relationship" | "event";
  id: string;
  title?: string;
  premise?: string;
  description?: string;
  payoff?: string | null;
  instruction?: string;
  label?: string | null;
  notes?: string | null;
  priority?: number;
  progress?: number;
  position?: number;
  urgency?: number;
  trust?: number;
  affection?: number;
  tension?: number;
  respect?: number;
  arcStatus?: StoryArcStatus;
  beatStatus?: StoryBeatStatus;
  hookStatus?: StoryHookStatus;
  eventStatus?: StoryProactiveStatus;
  directorOnly?: boolean;
}) {
  await resolveOwnedNarrativeContext(storyId, userId);

  if (input.kind === "arc") {
    const result = await prisma.storyArc.updateMany({
      where: { id: input.id, storyId },
      data: compact({ title: input.title, premise: input.premise, priority: input.priority, progress: input.progress, status: input.arcStatus })
    });
    ensureUpdated(result.count);
    return prisma.storyArc.findUniqueOrThrow({ where: { id: input.id } });
  }
  if (input.kind === "beat") {
    const completed = input.beatStatus === StoryBeatStatus.COMPLETED || input.beatStatus === StoryBeatStatus.SKIPPED;
    const result = await prisma.storyBeat.updateMany({
      where: { id: input.id, storyId },
      data: compact({
        title: input.title,
        description: input.description,
        position: input.position,
        priority: input.priority,
        status: input.beatStatus,
        resolvedAt: input.beatStatus ? (completed ? new Date() : null) : undefined
      })
    });
    ensureUpdated(result.count);
    return prisma.storyBeat.findUniqueOrThrow({ where: { id: input.id } });
  }
  if (input.kind === "hook") {
    const resolved = input.hookStatus === StoryHookStatus.RESOLVED || input.hookStatus === StoryHookStatus.DROPPED;
    const result = await prisma.storyHook.updateMany({
      where: { id: input.id, storyId },
      data: compact({
        title: input.title,
        description: input.description,
        payoff: input.payoff,
        urgency: input.urgency,
        directorOnly: input.directorOnly,
        status: input.hookStatus,
        resolvedAt: input.hookStatus ? (resolved ? new Date() : null) : undefined
      })
    });
    ensureUpdated(result.count);
    return prisma.storyHook.findUniqueOrThrow({ where: { id: input.id } });
  }
  if (input.kind === "relationship") {
    const existing = await prisma.storyRelationshipState.findFirst({ where: { id: input.id, storyId } });
    if (!existing) throw new HttpError(404, "Story item not found.");
    await prisma.storyRelationshipRevision.create({ data: { relationshipId: existing.id, label: existing.label, trust: existing.trust, affection: existing.affection, tension: existing.tension, respect: existing.respect, notes: existing.notes } });
    const result = await prisma.storyRelationshipState.updateMany({
      where: { id: input.id, storyId },
      data: {
        ...compact({
          label: input.label,
          notes: input.notes,
          trust: input.trust,
          affection: input.affection,
          tension: input.tension,
          respect: input.respect
        }),
        version: { increment: 1 }
      }
    });
    ensureUpdated(result.count);
    return prisma.storyRelationshipState.findUniqueOrThrow({ where: { id: input.id } });
  }

  const fired = input.eventStatus === StoryProactiveStatus.FIRED;
  const result = await prisma.storyProactiveEvent.updateMany({
    where: { id: input.id, storyId },
    data: compact({
      title: input.title,
      instruction: input.instruction,
      priority: input.priority,
      status: input.eventStatus,
      firedAt: input.eventStatus ? (fired ? new Date() : null) : undefined
    })
  });
  ensureUpdated(result.count);
  return prisma.storyProactiveEvent.findUniqueOrThrow({ where: { id: input.id } });
}

export async function markStoryProactiveEventsFired(input: {
  eventIds: string[];
  storyId: string;
  sourceMessageId?: string;
  sourceRoomMessageId?: string;
}) {
  if (input.eventIds.length === 0) {
    return;
  }
  const turn = await prisma.storyTurn.findFirst({
    where: {
      storyId: input.storyId,
      OR: [
        ...(input.sourceMessageId ? [{ sourceMessageId: input.sourceMessageId }] : []),
        ...(input.sourceRoomMessageId ? [{ sourceRoomMessageId: input.sourceRoomMessageId }] : [])
      ]
    },
    select: { id: true }
  });
  await prisma.storyProactiveEvent.updateMany({
    where: {
      id: { in: input.eventIds },
      storyId: input.storyId,
      status: { in: [StoryProactiveStatus.SCHEDULED, StoryProactiveStatus.READY] }
    },
    data: { status: StoryProactiveStatus.FIRED, firedAt: new Date(), firedAtTurnId: turn?.id }
  });
}

async function resolveOwnedNarrativeContext(storyId: string, userId: string, requestedTimelineId?: string | null) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ownerId: userId },
    select: {
      id: true,
      timelines: { orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }], select: { id: true, label: true, isActive: true } },
      participants: { orderBy: { joinedAt: "asc" }, select: { id: true, displayName: true, role: true, characterId: true, userId: true } }
    }
  });
  if (!story) {
    throw new HttpError(404, "Story not found.");
  }
  const timeline = requestedTimelineId
    ? story.timelines.find((candidate) => candidate.id === requestedTimelineId)
    : story.timelines.find((candidate) => candidate.isActive) ?? story.timelines[0];
  if (!timeline) {
    throw new HttpError(409, "Story timeline is unavailable.");
  }
  return { timelineId: timeline.id, timeline, participants: story.participants };
}

async function assertArcBelongsToStory(arcId: string | null | undefined, storyId: string) {
  if (!arcId) {
    return;
  }
  const arc = await prisma.storyArc.findFirst({ where: { id: arcId, storyId }, select: { id: true } });
  if (!arc) {
    throw new HttpError(400, "Story arc is invalid.");
  }
}

function assertParticipantsBelongToStory(participants: Array<{ id: string }>, ids: string[]) {
  const known = new Set(participants.map((participant) => participant.id));
  if (ids.some((id) => !known.has(id))) {
    throw new HttpError(400, "Story participant is invalid.");
  }
}

function ensureUpdated(count: number) {
  if (count !== 1) {
    throw new HttpError(404, "Narrative item not found.");
  }
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
