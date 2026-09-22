import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { moderateText } from "@/lib/safety";
import { createPhysicalContinuityOutputGuard } from "@/lib/physical-continuity";
import type { LocalModel, LocalRequest } from "@/lib/local-model";
import type { ContextTrace } from "@/lib/context-trace";

export type LocalGenerationPayload = {
  selection: LocalModel;
  request: LocalRequest;
  trace: ContextTrace;
  persona: string | null;
  physicalContext: string | null;
  currentMessage: string;
  recentMessages: { role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }[];
  responsePrompt?: string;
  assistantAction: boolean;
  branchSourceMessageId?: string;
  actionRequestId?: string;
  temporaryPersonaId: string | null;
};

export async function prepareLocalGeneration(
  userId: string,
  chatId: string,
  expectedLastMessageId: string | undefined,
  payload: LocalGenerationPayload
) {
  const last = await prisma.message.findFirst({
    where: { chatId },
    orderBy: { sequence: "desc" },
    select: { id: true }
  });
  if (!last) throw new HttpError(409, "The chat has no opening scene.");
  if (last.id !== expectedLastMessageId)
    throw new HttpError(409, "The conversation changed while preparing the local turn. Refresh before retrying.");
  await prisma.localGeneration.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  return prisma.localGeneration.create({
    data: {
      userId,
      chatId,
      lastMessageId: last.id,
      payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    }
  });
}

export async function completeLocalGeneration(input: {
  userId: string;
  chatId: string;
  generationId: string;
  content: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.chatId}, 0))::text AS lock_result`;
    const chat = await tx.chat.findFirst({
      where: { id: input.chatId, userId: input.userId, archivedAt: null },
      include: { character: true }
    });
    if (!chat) throw new HttpError(404, "Chat not found.");
    const generation = await tx.localGeneration.findFirst({
      where: { id: input.generationId, userId: input.userId, chatId: input.chatId }
    });
    if (!generation) throw new HttpError(404, "Local generation not found.");
    if (generation.completedMessageId) {
      const saved = await tx.message.findUnique({ where: { id: generation.completedMessageId } });
      if (!saved) throw new HttpError(409, "This local reply was removed. Start a new turn.");
      return saved;
    }
    if (generation.expiresAt <= new Date()) throw new HttpError(410, "This local turn expired. Retry your message.");
    const latest = await tx.message.findFirst({ where: { chatId: chat.id }, orderBy: { sequence: "desc" } });
    if (latest?.id !== generation.lastMessageId)
      throw new HttpError(409, "The conversation changed during local generation. Refresh before retrying.");
    const prepared = generation.payload as unknown as LocalGenerationPayload;
    const guard = createPhysicalContinuityOutputGuard(chat.character, prepared.persona, {
      recentMessages: prepared.recentMessages,
      currentMessage: prepared.currentMessage,
      persistentPlayerContext: prepared.physicalContext
    });
    const content = guard.push(input.content) + guard.flush();
    const moderation = moderateText({ text: content, context: "assistant" });
    if (!moderation.allowed)
      throw new HttpError(400, moderation.reason ?? "The response did not pass the platform safety policy.");
    if (!content.trim()) throw new HttpError(400, "The local model returned no visible reply.");
    const assistant = await tx.message.create({
      data: {
        chatId: chat.id,
        sequence: (latest.sequence ?? 0) + 1,
        role: "ASSISTANT",
        content,
        provider: prepared.selection.engine,
        model: prepared.selection.model,
        estimatedCost: 0,
        usageEstimated: true,
        clientRequestId: prepared.actionRequestId ?? `local-${generation.id}`,
        branchSourceMessageId: prepared.branchSourceMessageId,
        contextTrace: { create: { snapshot: prepared.trace as unknown as Prisma.InputJsonValue } }
      }
    });
    await tx.chat.update({
      where: { id: chat.id },
      data: {
        messageCount: await tx.message.count({ where: { chatId: chat.id } }),
        activeAssistantMessageId: assistant.id,
        lastActiveAt: new Date(),
        temperature: prepared.request.temperature,
        responsePrompt: prepared.responsePrompt === undefined ? undefined : prepared.responsePrompt || null,
        summary: prepared.assistantAction ? null : undefined,
        summaryThroughSequence: prepared.assistantAction ? 0 : undefined,
        temporaryPersonaId: chat.temporaryPersonaId === prepared.temporaryPersonaId ? null : undefined
      }
    });
    await tx.localGeneration.update({
      where: { id: generation.id },
      data: { completedMessageId: assistant.id, payload: {} }
    });
    return assistant;
  });
}
