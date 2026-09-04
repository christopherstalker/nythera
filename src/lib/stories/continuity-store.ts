import "server-only";

import { Prisma, StoryCheckpointKind, StoryVisualKind } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function getStoryContinuity(storyId: string, userId: string, requestedTimelineId?: string | null) {
  const context = await resolveContinuityContext(storyId, userId, requestedTimelineId);
  const [states, voiceBindings, visualReferences, checkpoints] = await Promise.all([
    prisma.storyParticipantState.findMany({
      where: { storyId, timelineId: context.timelineId },
      orderBy: { updatedAt: "desc" },
      include: { participant: { select: { id: true, displayName: true, role: true, characterId: true } } }
    }),
    prisma.storyVoiceBinding.findMany({
      where: { storyId },
      orderBy: { updatedAt: "desc" },
      include: { participant: { select: { id: true, displayName: true, role: true, characterId: true } } }
    }),
    prisma.storyVisualReference.findMany({
      where: { storyId, OR: [{ timelineId: null }, { timelineId: context.timelineId }] },
      orderBy: [{ locked: "desc" }, { updatedAt: "desc" }],
      include: {
        participant: { select: { id: true, displayName: true, role: true } },
        entity: { select: { id: true, name: true, type: true } }
      }
    }),
    prisma.storyCheckpoint.findMany({
      where: { storyId, timelineId: context.timelineId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { sourceTurn: { select: { id: true, sequence: true } } }
    })
  ]);
  return {
    timeline: context.timeline,
    participants: context.participants,
    entities: context.entities,
    states,
    voiceBindings,
    visualReferences,
    checkpoints
  };
}

export async function upsertStoryParticipantState(storyId: string, userId: string, input: {
  timelineId?: string | null;
  participantId: string;
  displayNameOverride?: string | null;
  pronouns?: string | null;
  currentMood?: string | null;
  appearance?: string | null;
  currentGoal?: string | null;
  innerConflict?: string | null;
  voiceStyle?: string | null;
  speakingStyle?: string | null;
}) {
  const context = await resolveContinuityContext(storyId, userId, input.timelineId);
  assertKnown(input.participantId, context.participants, "Story participant is invalid.");
  const data = {
    displayNameOverride: input.displayNameOverride,
    pronouns: input.pronouns,
    currentMood: input.currentMood,
    appearance: input.appearance,
    currentGoal: input.currentGoal,
    innerConflict: input.innerConflict,
    voiceStyle: input.voiceStyle,
    speakingStyle: input.speakingStyle
  };
  return prisma.storyParticipantState.upsert({
    where: { timelineId_participantId: { timelineId: context.timelineId, participantId: input.participantId } },
    create: { storyId, timelineId: context.timelineId, participantId: input.participantId, ...data },
    update: { ...data, version: { increment: 1 } }
  });
}

export async function upsertStoryVoiceBinding(storyId: string, userId: string, input: {
  participantId: string;
  provider: string;
  voiceId: string;
  style?: string | null;
  speed: number;
  pitch: number;
  autoPlay: boolean;
}) {
  const context = await resolveContinuityContext(storyId, userId);
  assertKnown(input.participantId, context.participants, "Story participant is invalid.");
  const data = {
    provider: input.provider,
    voiceId: input.voiceId,
    style: input.style,
    speed: input.speed,
    pitch: input.pitch,
    autoPlay: input.autoPlay
  };
  return prisma.storyVoiceBinding.upsert({
    where: { storyId_participantId: { storyId, participantId: input.participantId } },
    create: { storyId, participantId: input.participantId, ...data },
    update: data
  });
}

export async function createStoryVisualReference(storyId: string, userId: string, input: {
  timelineId?: string | null;
  participantId?: string | null;
  entityId?: string | null;
  visualKind: StoryVisualKind;
  title: string;
  imageUrl?: string | null;
  prompt?: string | null;
  notes?: string | null;
  locked: boolean;
}) {
  const context = await resolveContinuityContext(storyId, userId, input.timelineId);
  if (input.participantId) {
    assertKnown(input.participantId, context.participants, "Story participant is invalid.");
  }
  if (input.entityId) {
    assertKnown(input.entityId, context.entities, "Story entity is invalid.");
  }
  return prisma.storyVisualReference.create({
    data: {
      storyId,
      timelineId: input.timelineId === null ? null : context.timelineId,
      participantId: input.participantId,
      entityId: input.entityId,
      kind: input.visualKind,
      title: input.title,
      imageUrl: input.imageUrl,
      prompt: input.prompt,
      notes: input.notes,
      locked: input.locked
    }
  });
}

export async function createStoryCheckpoint(storyId: string, userId: string, input: {
  timelineId?: string | null;
  checkpointKind: "MANUAL" | "BOOKMARK";
  title: string;
  summary?: string | null;
  openThreads: string[];
}) {
  const context = await resolveContinuityContext(storyId, userId, input.timelineId);
  return createCheckpointFromContext({
    storyId,
    timelineId: context.timelineId,
    kind: input.checkpointKind as StoryCheckpointKind,
    title: input.title,
    summary: input.summary,
    openThreads: input.openThreads
  });
}

export async function ensureAutomaticStoryCheckpoint(input: {
  storyId: string;
  timelineId: string;
  summary?: string | null;
}) {
  const latestTurn = await prisma.storyTurn.findFirst({
    where: { storyId: input.storyId, timelineId: input.timelineId },
    orderBy: { sequence: "desc" },
    select: { id: true, sequence: true }
  });
  if (!latestTurn || latestTurn.sequence < 20 || latestTurn.sequence % 20 !== 0) {
    return null;
  }
  const existing = await prisma.storyCheckpoint.findFirst({
    where: { storyId: input.storyId, timelineId: input.timelineId, sourceTurnId: latestTurn.id, kind: StoryCheckpointKind.AUTO },
    select: { id: true }
  });
  if (existing) {
    return existing;
  }
  return createCheckpointFromContext({
    storyId: input.storyId,
    timelineId: input.timelineId,
    kind: StoryCheckpointKind.AUTO,
    title: `Automatic checkpoint · turn ${latestTurn.sequence}`,
    summary: input.summary,
    openThreads: []
  });
}

async function createCheckpointFromContext(input: {
  storyId: string;
  timelineId: string;
  kind: StoryCheckpointKind;
  title: string;
  summary?: string | null;
  openThreads: string[];
}) {
  const [turns, snapshot, hooks, arcs, facts, relationships] = await Promise.all([
    prisma.storyTurn.findMany({ where: { timelineId: input.timelineId }, orderBy: { sequence: "desc" }, take: 8 }),
    prisma.storyStateSnapshot.findFirst({ where: { timelineId: input.timelineId }, orderBy: { version: "desc" } }),
    prisma.storyHook.findMany({ where: { timelineId: input.timelineId, status: { in: ["OPEN", "ESCALATED"] } }, orderBy: { urgency: "desc" }, take: 12 }),
    prisma.storyArc.findMany({ where: { storyId: input.storyId, status: "ACTIVE", OR: [{ timelineId: null }, { timelineId: input.timelineId }] }, take: 8 }),
    prisma.storyFact.findMany({ where: { storyId: input.storyId, status: "ACTIVE", OR: [{ timelineId: null }, { timelineId: input.timelineId }] }, orderBy: [{ locked: "desc" }, { importance: "desc" }], take: 24, select: { id: true, predicate: true, objectText: true } }),
    prisma.storyRelationshipState.findMany({ where: { timelineId: input.timelineId }, include: { fromParticipant: true, toParticipant: true } })
  ]);
  const latestTurn = turns[0];
  const summary = input.summary?.trim() || [
    arcs.length ? `Active arcs: ${arcs.map((arc) => `${arc.title} (${arc.progress}%)`).join("; ")}.` : null,
    turns.length ? `Recent events:\n${turns.slice().reverse().map((turn) => `- ${turn.content.slice(0, 500)}`).join("\n")}` : "No story turns yet.",
    snapshot ? `World state: ${JSON.stringify(snapshot.state).slice(0, 2200)}` : null
  ].filter(Boolean).join("\n\n");
  const relationshipSnapshot = relationships.map((relationship) => ({
    from: relationship.fromParticipant.displayName,
    to: relationship.toParticipant.displayName,
    label: relationship.label,
    trust: relationship.trust,
    affection: relationship.affection,
    tension: relationship.tension,
    respect: relationship.respect
  })) satisfies Prisma.InputJsonArray;
  return prisma.storyCheckpoint.create({
    data: {
      storyId: input.storyId,
      timelineId: input.timelineId,
      sourceTurnId: latestTurn?.id,
      kind: input.kind,
      title: input.title,
      summary,
      openThreads: input.openThreads.length ? input.openThreads : hooks.map((hook) => hook.title),
      importantFactIds: facts.map((fact) => fact.id),
      stateVersion: snapshot?.version ?? 0,
      relationshipSnapshot
    }
  });
}

async function resolveContinuityContext(storyId: string, userId: string, requestedTimelineId?: string | null) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ownerId: userId },
    select: {
      timelines: { orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }], select: { id: true, label: true, isActive: true } },
      participants: { orderBy: { joinedAt: "asc" }, select: { id: true, displayName: true, role: true, characterId: true, userId: true } },
      entities: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, type: true } }
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
  return { timelineId: timeline.id, timeline, participants: story.participants, entities: story.entities };
}

function assertKnown(id: string, rows: Array<{ id: string }>, message: string) {
  if (!rows.some((row) => row.id === id)) {
    throw new HttpError(400, message);
  }
}
