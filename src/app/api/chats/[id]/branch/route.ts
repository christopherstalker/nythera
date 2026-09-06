import { MessageRole } from "@prisma/client";
import { z } from "zod";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { syncChatTurns } from "@/lib/stories/story-foundation";
import { conversationBranchThroughMessage } from "@/lib/message-actions";
import { normalizeChatAppearance } from "@/lib/chat-appearance";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

const branchSchema = z.object({
  messageId: z.string().min(1),
  title: z.string().max(120).optional()
});

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chats:branch"
    });

    const input = await parseJson(request, branchSchema);
    const foundation = await syncChatTurns((await context.params).id, user.id);
    const source = await prisma.chat.findFirst({
      where: {
        id: (await context.params).id,
        userId: user.id
      },
      include: {
        messages: {
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }],
          include: { attachments: { orderBy: { position: "asc" } } }
        },
        timeline: true
      }
    });

    if (!source) {
      throw new HttpError(404, "Chat not found.");
    }

    const messages = conversationBranchThroughMessage(
      source.messages.filter((message) => message.role !== MessageRole.SYSTEM),
      input.messageId
    );
    if (!messages) {
      throw new HttpError(404, "Message not found.");
    }
    const forkSequence = messages.length;

    const graphCounts = await Promise.all([
      prisma.storyFact.count({ where: { storyId: foundation.storyId, timelineId: foundation.timelineId } }),
      prisma.storyArc.count({ where: { storyId: foundation.storyId, timelineId: foundation.timelineId } }),
      prisma.storyBeat.count({ where: { storyId: foundation.storyId, timelineId: foundation.timelineId } }),
      prisma.storyHook.count({ where: { storyId: foundation.storyId, timelineId: foundation.timelineId } }),
      prisma.storyRelationshipState.count({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId }
      }),
      prisma.storyProactiveEvent.count({ where: { storyId: foundation.storyId, timelineId: foundation.timelineId } }),
      prisma.storyVisualReference.count({ where: { storyId: foundation.storyId, timelineId: foundation.timelineId } })
    ]);
    if (graphCounts.reduce((sum, count) => sum + count, 0) > 1000) {
      throw new HttpError(413, "This story graph is too large to branch safely.");
    }

    const forkedFromTurn = await prisma.storyTurn.findFirst({
      where: { timelineId: foundation.timelineId, sourceMessageId: input.messageId },
      select: { id: true }
    });

    const branch = await prisma.$transaction(async (tx) => {
      await tx.storyTimeline.updateMany({
        where: { storyId: foundation.storyId, isActive: true },
        data: { isActive: false }
      });
      const timeline = await tx.storyTimeline.create({
        data: {
          storyId: foundation.storyId,
          parentTimelineId: foundation.timelineId,
          forkedFromTurnId: forkedFromTurn?.id,
          label: input.title?.trim() || `Branch after turn ${forkSequence}`,
          isActive: true
        }
      });
      const created = await tx.chat.create({
        data: {
          userId: user.id,
          characterId: source.characterId,
          personaId: source.personaId,
          appearance: { ...normalizeChatAppearance(source.appearance) },
          storyId: foundation.storyId,
          timelineId: timeline.id,
          title: input.title?.trim() || `${source.title || "Untitled chat"} · Branch`,
          temperature: source.temperature,
          model: source.model,
          responsePrompt: source.responsePrompt,
          summary: source.summaryThroughSequence <= messages.length ? source.summary : null,
          summaryThroughSequence: source.summaryThroughSequence <= messages.length ? source.summaryThroughSequence : 0,
          messageCount: messages.length
        }
      });

      let activeAssistantMessageId: string | null = null;
      for (const [index, message] of messages.entries()) {
        const copied = await tx.message.create({
          data: {
            chatId: created.id,
            sequence: index + 1,
            role: message.role,
            content: message.content,
            tokens: message.tokens,
            model: message.model,
            provider: message.provider,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
            estimatedCost: message.estimatedCost,
            usageEstimated: message.usageEstimated,
            flagged: message.flagged
          }
        });
        if (message.role === MessageRole.ASSISTANT) {
          activeAssistantMessageId = copied.id;
        }
        if (message.attachments.length) {
          await tx.messageAttachment.createMany({
            data: message.attachments.map((attachment) => ({
              messageId: copied.id,
              assetId: attachment.assetId,
              position: attachment.position
            }))
          });
        }
        await tx.storyTurn.create({
          data: {
            storyId: foundation.storyId,
            timelineId: timeline.id,
            sequence: index + 1,
            actorUserId: message.role === MessageRole.USER ? user.id : null,
            actorCharacterId: message.role === MessageRole.ASSISTANT ? source.characterId : null,
            sourceMessageId: copied.id,
            content: message.content,
            metadata: { branchedFromMessageId: message.id }
          }
        });
      }

      const sourceFacts = await tx.storyFact.findMany({
        where: {
          storyId: foundation.storyId,
          timelineId: foundation.timelineId,
          status: "ACTIVE",
          OR: [
            { kind: { in: ["PERMANENT", "EVENT"] } },
            {
              kind: "STATE",
              AND: [
                { OR: [{ validFromSequence: null }, { validFromSequence: { lte: forkSequence } }] },
                { OR: [{ validUntilSequence: null }, { validUntilSequence: { gte: forkSequence } }] }
              ]
            }
          ]
        },
        include: { knowledge: true }
      });
      for (const fact of sourceFacts) {
        const copiedFact = await tx.storyFact.create({
          data: {
            storyId: foundation.storyId,
            timelineId: timeline.id,
            subjectEntityId: fact.subjectEntityId,
            objectEntityId: fact.objectEntityId,
            sourceTurnId: fact.sourceTurnId,
            sourceMessageId: fact.sourceMessageId,
            predicate: fact.predicate,
            objectText: fact.objectText,
            objectData: fact.objectData ?? undefined,
            kind: fact.kind,
            worldTime: fact.worldTime,
            validFromSequence: fact.validFromSequence,
            validUntilSequence: fact.validUntilSequence,
            scope: fact.scope,
            status: fact.status,
            confidence: fact.confidence,
            importance: fact.importance,
            locked: fact.locked,
            metadata: { inheritedFromFactId: fact.id }
          }
        });
        if (fact.knowledge.length > 0) {
          await tx.storyKnowledge.createMany({
            data: fact.knowledge.map((entry) => ({
              factId: copiedFact.id,
              participantId: entry.participantId,
              state: entry.state,
              learnedAtTurnId: entry.learnedAtTurnId
            }))
          });
        }
      }

      const sourceArcs = await tx.storyArc.findMany({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId }
      });
      const arcIdMap = new Map<string, string>();
      for (const arc of sourceArcs) {
        const copiedArc = await tx.storyArc.create({
          data: {
            storyId: foundation.storyId,
            timelineId: timeline.id,
            title: arc.title,
            premise: arc.premise,
            status: arc.status,
            priority: arc.priority,
            progress: arc.progress,
            targetBeatCount: arc.targetBeatCount
          }
        });
        arcIdMap.set(arc.id, copiedArc.id);
      }

      const sourceBeats = await tx.storyBeat.findMany({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId },
        include: { resolvedByTurn: { select: { sequence: true } } }
      });
      if (sourceBeats.length > 0) {
        await tx.storyBeat.createMany({
          data: sourceBeats.map((beat) => {
            const resolvedAfterFork = (beat.resolvedByTurn?.sequence ?? 0) > forkSequence;
            return {
              storyId: foundation.storyId,
              timelineId: timeline.id,
              arcId: beat.arcId ? (arcIdMap.get(beat.arcId) ?? null) : null,
              resolvedByTurnId: resolvedAfterFork ? null : beat.resolvedByTurnId,
              title: beat.title,
              description: beat.description,
              status: resolvedAfterFork ? ("PLANNED" as const) : beat.status,
              position: beat.position,
              priority: beat.priority,
              trigger: beat.trigger ?? undefined,
              resolvedAt: resolvedAfterFork ? null : beat.resolvedAt
            };
          })
        });
      }

      const sourceHooks = await tx.storyHook.findMany({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId },
        include: { resolvedByTurn: { select: { sequence: true } } }
      });
      if (sourceHooks.length > 0) {
        await tx.storyHook.createMany({
          data: sourceHooks.map((hook) => {
            const resolvedAfterFork = (hook.resolvedByTurn?.sequence ?? 0) > forkSequence;
            return {
              storyId: foundation.storyId,
              timelineId: timeline.id,
              arcId: hook.arcId ? (arcIdMap.get(hook.arcId) ?? null) : null,
              openedByTurnId: hook.openedByTurnId,
              resolvedByTurnId: resolvedAfterFork ? null : hook.resolvedByTurnId,
              title: hook.title,
              description: hook.description,
              payoff: hook.payoff,
              status: resolvedAfterFork ? ("OPEN" as const) : hook.status,
              urgency: hook.urgency,
              directorOnly: hook.directorOnly,
              dueSequence: hook.dueSequence,
              resolvedAt: resolvedAfterFork ? null : hook.resolvedAt
            };
          })
        });
      }

      const sourceRelationships = await tx.storyRelationshipState.findMany({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId }
      });
      if (sourceRelationships.length > 0) {
        await tx.storyRelationshipState.createMany({
          data: sourceRelationships.map((relationship) => ({
            storyId: foundation.storyId,
            timelineId: timeline.id,
            fromParticipantId: relationship.fromParticipantId,
            toParticipantId: relationship.toParticipantId,
            label: relationship.label,
            trust: relationship.trust,
            affection: relationship.affection,
            tension: relationship.tension,
            respect: relationship.respect,
            notes: relationship.notes,
            version: relationship.version
          }))
        });
      }

      const sourceEvents = await tx.storyProactiveEvent.findMany({
        where: {
          storyId: foundation.storyId,
          timelineId: foundation.timelineId,
          status: { in: ["SCHEDULED", "READY"] }
        }
      });
      if (sourceEvents.length > 0) {
        await tx.storyProactiveEvent.createMany({
          data: sourceEvents.map((event) => ({
            storyId: foundation.storyId,
            timelineId: timeline.id,
            actorParticipantId: event.actorParticipantId,
            createdByTurnId: event.createdByTurnId,
            title: event.title,
            instruction: event.instruction,
            status: event.status,
            channel: event.channel,
            priority: event.priority,
            dueSequence: event.dueSequence,
            triggerAt: event.triggerAt,
            metadata: event.metadata ?? undefined
          }))
        });
      }

      const sourceParticipantStates = await tx.storyParticipantState.findMany({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId }
      });
      if (sourceParticipantStates.length > 0) {
        await tx.storyParticipantState.createMany({
          data: sourceParticipantStates.map((state) => ({
            storyId: foundation.storyId,
            timelineId: timeline.id,
            participantId: state.participantId,
            displayNameOverride: state.displayNameOverride,
            pronouns: state.pronouns,
            currentMood: state.currentMood,
            appearance: state.appearance,
            currentGoal: state.currentGoal,
            innerConflict: state.innerConflict,
            voiceStyle: state.voiceStyle,
            speakingStyle: state.speakingStyle,
            metadata: state.metadata ?? undefined,
            version: state.version
          }))
        });
      }

      const sourceVisualReferences = await tx.storyVisualReference.findMany({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId }
      });
      if (sourceVisualReferences.length > 0) {
        await tx.storyVisualReference.createMany({
          data: sourceVisualReferences.map((reference) => ({
            storyId: foundation.storyId,
            timelineId: timeline.id,
            participantId: reference.participantId,
            entityId: reference.entityId,
            kind: reference.kind,
            title: reference.title,
            imageUrl: reference.imageUrl,
            prompt: reference.prompt,
            notes: reference.notes,
            locked: reference.locked
          }))
        });
      }

      const latestCheckpoint = await tx.storyCheckpoint.findFirst({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId },
        orderBy: { createdAt: "desc" }
      });
      if (latestCheckpoint) {
        await tx.storyCheckpoint.create({
          data: {
            storyId: foundation.storyId,
            timelineId: timeline.id,
            sourceTurnId: forkedFromTurn?.id,
            kind: "BOOKMARK",
            title: `Branch origin · ${latestCheckpoint.title}`,
            summary: latestCheckpoint.summary,
            openThreads: latestCheckpoint.openThreads,
            importantFactIds: latestCheckpoint.importantFactIds,
            stateVersion: latestCheckpoint.stateVersion,
            relationshipSnapshot: latestCheckpoint.relationshipSnapshot ?? undefined
          }
        });
      }

      const latestSnapshot = await tx.storyStateSnapshot.findFirst({
        where: { timelineId: foundation.timelineId },
        orderBy: { version: "desc" }
      });
      const sourceScene = await tx.storyScene.findFirst({
        where: { storyId: foundation.storyId, timelineId: foundation.timelineId, status: "ACTIVE" },
        orderBy: { startedAtSequence: "desc" }
      });
      const scene = await tx.storyScene.create({
        data: {
          storyId: foundation.storyId,
          timelineId: timeline.id,
          status: "ACTIVE",
          title: sourceScene?.title ?? "Current scene",
          worldTime: sourceScene?.worldTime,
          location: sourceScene?.location,
          startedAtSequence: forkSequence
        }
      });
      await tx.storyStateSnapshot.create({
        data: {
          storyId: foundation.storyId,
          timelineId: timeline.id,
          sceneId: scene.id,
          version: 0,
          state: latestSnapshot?.state ?? {}
        }
      });
      await tx.story.update({
        where: { id: foundation.storyId },
        data: { lastActiveAt: new Date() }
      });

      return tx.chat.update({
        where: { id: created.id },
        data: { activeAssistantMessageId }
      });
    });

    return json({ chat: branch }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
