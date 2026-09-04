import "server-only";

import { Prisma, StoryBeatStatus, StoryHookStatus, StoryKnowledgeState, StoryProactiveStatus } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { buildConversationSummary } from "@/lib/memory";
import { selectPersistedConversationBranch } from "@/lib/message-actions";
import { prisma } from "@/lib/prisma";

export async function rewindChat(input: { chatId: string; userId: string; messageId: string }, attempt = 0): Promise<{
  chatId: string;
  retainedMessageCount: number;
  deletedMessageIds: string[];
  summaryRebuilt: boolean;
  summary: string | null;
}> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const chat = await tx.chat.findFirst({
          where: { id: input.chatId, userId: input.userId },
          select: { id: true, storyId: true, timelineId: true }
        });
        if (!chat) {
          throw new HttpError(404, "Chat not found.");
        }

        const messages = await tx.message.findMany({
          where: { chatId: chat.id },
          orderBy: [{ createdAt: "asc" }, { sequence: "asc" }, { id: "asc" }],
          select: {
            id: true,
            role: true,
            content: true,
            sequence: true,
            createdAt: true,
            clientRequestId: true,
            branchSourceMessageId: true
          }
        });
        const targetIndex = messages.findIndex((message) => message.id === input.messageId);
        if (targetIndex < 0) {
          throw new HttpError(404, "Message not found.");
        }

        const target = messages[targetIndex];
        const retainedMessages = messages.slice(0, targetIndex + 1);
        const deletedMessageIds = messages.slice(targetIndex + 1).map((message) => message.id);

        if (deletedMessageIds.length > 0) {
          await rewindStoryState(tx, {
            storyId: chat.storyId,
            timelineId: chat.timelineId,
            targetMessageId: target.id,
            deletedMessageIds
          });

          await tx.memory.deleteMany({
            where: {
              sourceChatId: chat.id,
              OR: [
                { sourceMessageId: { in: deletedMessageIds } },
                { sourceMessageId: null, createdAt: { gt: target.createdAt } }
              ]
            }
          });
          await tx.message.deleteMany({ where: { id: { in: deletedMessageIds }, chatId: chat.id } });
        }

        const retainedBranch = selectPersistedConversationBranch(retainedMessages);
        const summary = retainedBranch.length > 20 ? buildConversationSummary(retainedBranch) : null;
        const summaryThroughSequence = summary ? retainedBranch.at(-1)?.sequence ?? 0 : 0;
        const activeAssistantMessageId = [...retainedBranch].reverse().find((message) => message.role === "ASSISTANT")?.id ?? null;
        await tx.chat.update({
          where: { id: chat.id },
          data: {
            messageCount: retainedMessages.length,
            summary,
            summaryThroughSequence,
            activeAssistantMessageId,
            updatedAt: new Date(),
            lastActiveAt: new Date()
          }
        });

        return {
          chatId: chat.id,
          retainedMessageCount: retainedMessages.length,
          deletedMessageIds,
          summaryRebuilt: Boolean(summary),
          summary
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) {
      return rewindChat(input, attempt + 1);
    }
    throw error;
  }
}

async function rewindStoryState(
  tx: Prisma.TransactionClient,
  input: {
    storyId: string | null;
    timelineId: string | null;
    targetMessageId: string;
    deletedMessageIds: string[];
  }
) {
  if (!input.storyId || !input.timelineId) {
    return;
  }

  const targetTurn = await tx.storyTurn.findFirst({
    where: { timelineId: input.timelineId, sourceMessageId: input.targetMessageId },
    select: { sequence: true }
  });
  const removedTurns = await tx.storyTurn.findMany({
    where: {
      timelineId: input.timelineId,
      OR: [
        { sourceMessageId: { in: input.deletedMessageIds } },
        ...(targetTurn ? [{ sequence: { gt: targetTurn.sequence } }] : [])
      ]
    },
    select: { id: true }
  });
  const removedTurnIds = removedTurns.map((turn) => turn.id);
  if (removedTurnIds.length === 0) {
    return;
  }

  await tx.storyProactiveEvent.updateMany({
    where: { storyId: input.storyId, firedAtTurnId: { in: removedTurnIds } },
    data: { status: StoryProactiveStatus.READY, firedAt: null, firedAtTurnId: null }
  });
  await tx.storyProactiveEvent.deleteMany({
    where: { storyId: input.storyId, createdByTurnId: { in: removedTurnIds } }
  });
  await tx.storyBeat.updateMany({
    where: { storyId: input.storyId, resolvedByTurnId: { in: removedTurnIds } },
    data: { status: StoryBeatStatus.READY, resolvedAt: null, resolvedByTurnId: null }
  });
  await tx.storyHook.updateMany({
    where: { storyId: input.storyId, resolvedByTurnId: { in: removedTurnIds } },
    data: { status: StoryHookStatus.OPEN, resolvedAt: null, resolvedByTurnId: null }
  });
  await tx.storyHook.updateMany({
    where: { storyId: input.storyId, openedByTurnId: { in: removedTurnIds } },
    data: { status: StoryHookStatus.DROPPED, openedByTurnId: null, resolvedByTurnId: null, resolvedAt: null }
  });
  await tx.storyKnowledge.updateMany({
    where: { learnedAtTurnId: { in: removedTurnIds } },
    data: { state: StoryKnowledgeState.FORGOTTEN, learnedAtTurnId: null }
  });
  await tx.storyFact.deleteMany({
    where: {
      storyId: input.storyId,
      OR: [
        { sourceTurnId: { in: removedTurnIds } },
        { sourceMessageId: { in: input.deletedMessageIds } }
      ]
    }
  });
  await tx.storyCheckpoint.deleteMany({
    where: { storyId: input.storyId, timelineId: input.timelineId, sourceTurnId: { in: removedTurnIds } }
  });
  await tx.storyStateSnapshot.deleteMany({
    where: { storyId: input.storyId, timelineId: input.timelineId, sourceTurnId: { in: removedTurnIds } }
  });
  await tx.storyTurn.deleteMany({ where: { id: { in: removedTurnIds } } });
}
