import "server-only";

import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function createStoryPackage(storyId: string, userId: string, publicView = false) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ownerId: userId },
    include: {
      participants: { orderBy: { joinedAt: "asc" }, select: { id: true, role: true, displayName: true, characterId: true } },
      timelines: {
        where: { isActive: true },
        take: 1,
        include: {
          turns: { orderBy: { sequence: "asc" }, take: 500, select: { sequence: true, channel: true, content: true, actorCharacterId: true, createdAt: true } },
          snapshots: { orderBy: { version: "desc" }, take: 1, select: { version: true, state: true } },
          scenes: { orderBy: { startedAtSequence: "asc" }, take: 100, select: { status: true, title: true, worldTime: true, location: true, startedAtSequence: true, endedAtSequence: true, summary: true } },
          participantStates: { select: { participantId: true, displayNameOverride: true, pronouns: true, currentMood: true, appearance: true, currentGoal: true, innerConflict: true, voiceStyle: true, speakingStyle: true } },
          visualReferences: { where: { locked: true }, select: { participantId: true, kind: true, title: true, imageUrl: true, prompt: true, notes: true } },
          checkpoints: { orderBy: { createdAt: "desc" }, take: 1, select: { title: true, summary: true, openThreads: true, stateVersion: true } }
        }
      },
      facts: {
        where: { status: "ACTIVE" },
        orderBy: [{ locked: "desc" }, { importance: "desc" }],
        take: 250,
        select: { predicate: true, objectText: true, kind: true, worldTime: true, validFromSequence: true, validUntilSequence: true, scope: true, locked: true, importance: true, timelineId: true, subjectEntity: { select: { name: true } } }
      },
      director: true,
      arcs: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 50 },
      beats: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 100 },
      hooks: { orderBy: [{ urgency: "desc" }, { createdAt: "asc" }], take: 100 },
      relationships: { include: { fromParticipant: { select: { displayName: true } }, toParticipant: { select: { displayName: true } } }, take: 100 },
      safetyProfile: true
    }
  });
  if (!story) {
    throw new HttpError(404, "Story not found.");
  }

  const timeline = story.timelines[0];
  const activeTimelineId = timeline?.id ?? null;
  const worldState = publicView ? withoutPrivateWorldNotes(timeline?.snapshots[0]?.state ?? null) : timeline?.snapshots[0]?.state ?? null;
  const facts = story.facts
    .filter((fact) => (!fact.timelineId || fact.timelineId === activeTimelineId) && (!publicView || fact.scope === "STORY"))
    .map((fact) => ({ subject: fact.subjectEntity?.name ?? null, predicate: fact.predicate, objectText: fact.objectText, kind: fact.kind, worldTime: fact.worldTime, validFromSequence: fact.validFromSequence, validUntilSequence: fact.validUntilSequence, scope: fact.scope, locked: fact.locked, importance: fact.importance }));
  const states = (timeline?.participantStates ?? []).map((state) => ({
    participantId: state.participantId,
    displayNameOverride: state.displayNameOverride,
    pronouns: state.pronouns,
    currentMood: state.currentMood,
    appearance: state.appearance,
    currentGoal: state.currentGoal,
    ...(publicView ? {} : { innerConflict: state.innerConflict }),
    voiceStyle: state.voiceStyle,
    speakingStyle: state.speakingStyle
  }));

  return {
    format: "nythera.story",
    version: 2,
    exportedAt: new Date().toISOString(),
    story: { title: story.title, mode: story.mode },
    timeline: timeline ? {
      label: timeline.label,
      turns: timeline.turns.map((turn) => ({ ...turn, createdAt: turn.createdAt.toISOString() })),
      scenes: timeline.scenes,
      worldState
    } : null,
    cast: story.participants,
    canon: facts,
    narrative: {
      director: story.director ? { ...story.director, notes: publicView ? null : story.director.notes } : null,
      arcs: story.arcs.filter((arc) => !arc.timelineId || arc.timelineId === activeTimelineId),
      beats: story.beats.filter((beat) => beat.timelineId === activeTimelineId),
      hooks: story.hooks.filter((hook) => hook.timelineId === activeTimelineId && (!publicView || !hook.directorOnly)),
      relationships: story.relationships.filter((relationship) => relationship.timelineId === activeTimelineId).map((relationship) => ({
        from: relationship.fromParticipant.displayName,
        to: relationship.toParticipant.displayName,
        label: relationship.label,
        trust: relationship.trust,
        affection: relationship.affection,
        tension: relationship.tension,
        respect: relationship.respect,
        notes: publicView ? null : relationship.notes
      }))
    },
    continuity: {
      participantStates: states,
      visualReferences: timeline?.visualReferences ?? [],
      checkpoint: publicView ? null : timeline?.checkpoints[0] ?? null
    },
    safety: story.safetyProfile ? {
      contentRating: story.safetyProfile.contentRating,
      paused: story.safetyProfile.paused,
      ...(publicView ? {} : {
        hardLimits: story.safetyProfile.hardLimits,
        softLimits: story.safetyProfile.softLimits,
        fadeToBlack: story.safetyProfile.fadeToBlack,
        checkInInterval: story.safetyProfile.checkInInterval,
        notes: story.safetyProfile.notes
      })
    } : null
  };
}

function withoutPrivateWorldNotes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "notes"));
}

export function storyPackageToMarkdown(value: Awaited<ReturnType<typeof createStoryPackage>>) {
  const lines = [`# ${value.story.title}`, "", `Mode: ${value.story.mode}`, `Timeline: ${value.timeline?.label ?? "Unavailable"}`, ""];
  if (value.cast.length) {
    lines.push("## Cast", "", ...value.cast.map((member) => `- ${member.displayName} — ${member.role}`), "");
  }
  if (value.timeline?.worldState) {
    lines.push("## World state", "", "```json", JSON.stringify(value.timeline.worldState, null, 2), "```", "");
  }
  if (value.canon.length) {
    lines.push("## Canon", "", ...value.canon.map((fact) => `- ${fact.subject ? `${fact.subject} ` : ""}${fact.predicate}: ${fact.objectText}${fact.locked ? " [locked]" : ""}`), "");
  }
  if (value.narrative.arcs.length) {
    lines.push("## Story arcs", "", ...value.narrative.arcs.map((arc) => `- **${arc.title}** (${arc.progress}%): ${arc.premise}`), "");
  }
  if (value.timeline?.turns.length) {
    lines.push("## Manuscript", "", ...value.timeline.turns.map((turn) => `### Turn ${turn.sequence} · ${turn.channel}\n\n${turn.content}\n`));
  }
  return lines.join("\n");
}
