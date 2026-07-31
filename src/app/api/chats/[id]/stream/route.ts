import { MessageRole } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { HttpError, getRequestIp, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText } from "@/lib/safety";
import { detectPromptInjection } from "@/lib/prompt-security";
import { streamMessageSchema } from "@/lib/validation";
import { assembleNytheraPrompt } from "@/lib/prompt-assembly";
import { streamLlmResponse } from "@/lib/proxy";
import { searchMemories } from "@/lib/vector";
import { schedulePostMessageJobs } from "@/lib/memory";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { formatUserPersonaForPrompt } from "@/lib/user-persona";
import { createMessageWithNextSequence } from "@/lib/message-sequence";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { prepareRegenerationTurn } from "@/lib/message-actions";
import { getStoryPromptContext, syncChatTurns } from "@/lib/stories/story-foundation";
import { markStoryProactiveEventsFired } from "@/lib/stories/narrative-store";
import { estimateModelCost } from "@/lib/model-pricing";
import { elapsedMs, logPerformanceMetric, measurePrismaOperation, performanceStart } from "@/lib/performance-logger";
import { logSafeError } from "@/lib/secret-redaction";

type Context = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: Context) {
  const started = Date.now();
  const streamStartedAt = performanceStart();

  try {
    const { id: chatId } = await context.params;
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chat:stream"
    });

    const input = await parseJson(request, streamMessageSchema);
    const continueChat = input.continueChat === true;
    const continuationPrompt =
      "Continue the roleplay naturally from the latest message. Do not speak as the user, do not invent a user reply, and keep the scene moving in the character's voice.";
    let message = continueChat ? continuationPrompt : sanitizeUserText(input.message);

    const chat = await measurePrismaOperation(
      {
        route: "chat:stream",
        operation: "load_prompt_context"
      },
      () =>
        prisma.chat.findFirst({
          where: {
            id: chatId,
            userId: user.id,
            archivedAt: null
          },
          include: {
            character: true,
            persona: true,
            messages: {
              orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
              take: 40
            }
          }
        }),
      (result) => ({
        found: Boolean(result),
        messageCount: result?.messages.length ?? 0
      })
    );

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    if (input.requestId) {
      const existingMessage = await prisma.message.findUnique({
        where: { clientRequestId: input.requestId },
        select: { id: true, chatId: true }
      });

      if (existingMessage?.chatId === chat.id) {
        throw new HttpError(409, "Duplicate chat request ignored.");
      }
    }

    const providerKeys = await getEffectiveProviderKeys(user.id);
    const effectiveSettings = resolveCharacterModelSettings({
      character: chat.character,
      providerKeys,
      globalModel: input.model ?? chat.model,
      chatTemperature: input.temperature ?? chat.temperature
    });
    const model = effectiveSettings.model;
    const temperature = effectiveSettings.temperature;
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chat:token-budget",
      cost: Math.min(effectiveSettings.maxTokens ?? 900, 4096)
    });
    let recentMessages = [...chat.messages].reverse();
    let userMessage: Awaited<ReturnType<typeof createMessageWithNextSequence>> | null = null;

    if (input.regenerate) {
      const regenerationTurn = prepareRegenerationTurn(recentMessages, input.regenerateMessageId);
      if (!regenerationTurn) {
        throw new HttpError(409, "Only the latest assistant response can be regenerated. Rewind or branch from an earlier turn.");
      }

      message = sanitizeUserText(regenerationTurn.currentMessage);
      recentMessages = regenerationTurn.recentMessages;
    }

    const injectionAssessment = detectPromptInjection(message);
    const moderation = moderateText({
      text: message,
      userIsMinor: isMinor(user.birthDate),
      context: "message"
    });

    if (!moderation.allowed) {
      throw new HttpError(400, moderation.reason ?? "Message blocked by safety policy.");
    }

    if (!input.regenerate && !continueChat) {
      userMessage = await createMessageWithNextSequence({
        chatId: chat.id,
        role: MessageRole.USER,
        content: message,
        clientRequestId: input.requestId
      });
    }

    const [memories, defaultUserPersona, storyContext] = await Promise.all([
      user.memoryEnabled
        ? searchMemories({
            userId: user.id,
            characterId: chat.characterId,
            query: message,
            limit: 5,
            providerKeys
          })
        : Promise.resolve([]),
      prisma.userPersona.findFirst({
        where: { userId: user.id, isDefault: true }
      }),
      getStoryPromptContext({ chatId: chat.id, userId: user.id, actorCharacterId: chat.characterId })
    ]);
    const userPersona = chat.persona ?? defaultUserPersona;

    const prompt = assembleNytheraPrompt({
      character: chat.character,
      memories,
      userPersona: formatUserPersonaForPrompt(userPersona),
      summary: chat.summary,
      recentMessages,
      currentMessage: message,
      responsePrompt: input.responsePrompt ?? chat.responsePrompt,
      storyContext: storyContext.text,
      injectionAssessment
    });

    const encoder = new TextEncoder();
    let assistantText = "";
    let firstClientTokenLogged = false;
    let outputBlocked = false;
    let assistantPersisted = false;
    let publicErrorMessage = "The model stream failed.";
    let usage: {
      inputTokens: number;
      outputTokens: number;
      model: string;
      provider: string;
      usageEstimated: boolean;
      latencyMs?: number;
      fallbackTriggered?: boolean;
      attempts?: string[];
    } = {
      inputTokens: 0,
      outputTokens: 0,
      model,
      provider: "unknown",
      usageEstimated: true
    };

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          if (userMessage) {
            send({ type: "user_message", message: userMessage });
          }

          for await (const chunk of streamLlmResponse({
            messages: prompt,
            model,
            temperature,
            topP: effectiveSettings.topP,
            frequencyPenalty: effectiveSettings.frequencyPenalty,
            presencePenalty: effectiveSettings.presencePenalty,
            maxTokens: effectiveSettings.maxTokens,
            userId: user.id,
            chatId: chat.id,
            providerKeys,
            signal: request.signal
          })) {
            if (chunk.type === "delta") {
              const nextText = assistantText + chunk.text;
              const check = moderateText({
                text: nextText,
                userIsMinor: isMinor(user.birthDate),
                context: "assistant"
              });

              if (!check.allowed) {
                outputBlocked = true;
                const replacement =
                  check.reason ?? "The response was stopped because it did not pass the platform safety policy.";
                assistantText = replacement;
                send({ type: "delta", text: replacement });
                break;
              }

              assistantText = nextText;
              if (!firstClientTokenLogged) {
                firstClientTokenLogged = true;
                logPerformanceMetric("chat_stream_first_token", {
                  route: "chat:stream",
                  configuredModel: model,
                  durationMs: elapsedMs(streamStartedAt)
                });
              }
              send(chunk);
            }

            if (chunk.type === "usage") {
              usage = chunk;
            }

            if (chunk.type === "error") {
              publicErrorMessage = chunk.message;
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

          const assistant = await createMessageWithNextSequence({
            chatId: chat.id,
            role: MessageRole.ASSISTANT,
            content: assistantText,
            model: usage.model,
            tokens: usage.outputTokens,
            provider: usage.provider,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            estimatedCost,
            usageEstimated: usage.usageEstimated,
            flagged: outputBlocked,
            clientRequestId: continueChat ? `continue-${input.requestId || crypto.randomUUID()}` : undefined
          });
          assistantPersisted = true;
          const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
          const updated = await prisma.chat.update({
            where: { id: chat.id },
            data: {
              messageCount: actualMessageCount,
              model,
              temperature,
              responsePrompt: input.responsePrompt === undefined ? undefined : input.responsePrompt || null,
              lastActiveAt: new Date(),
              updatedAt: new Date()
            },
            select: { messageCount: true }
          });

          await prisma.llmRequestLog.create({
            data: {
              userId: user.id,
              chatId: chat.id,
              provider: usage.provider,
              model: usage.model,
              route: "chat",
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              estimatedCost,
              status: outputBlocked ? "blocked_output" : usage.fallbackTriggered ? "ok_fallback" : "ok",
              error: usage.fallbackTriggered ? `fallback attempts: ${(usage.attempts ?? []).join(" -> ")}`.slice(0, 2000) : null,
              latencyMs: Date.now() - started
            }
          });

          if (user.memoryEnabled && !continueChat) {
            await schedulePostMessageJobs({
              chatId: chat.id,
              userId: user.id,
              characterId: chat.characterId,
              latestUserMessage: message,
              latestAssistantMessage: assistant.content,
              messageCount: updated.messageCount,
              providerKeys
            });
          }

          await syncChatTurns(chat.id, user.id).catch((storyError) => {
            logSafeError("Story turn sync failed.", storyError);
          });
          await markStoryProactiveEventsFired({
            eventIds: storyContext.eventIds,
            storyId: storyContext.storyId,
            sourceMessageId: assistant.id
          }).catch((storyError) => {
            logSafeError("Story proactive event completion failed.", storyError);
          });

          send({ type: "message", message: assistant });
          send({ type: "done" });
        } catch (error) {
          logSafeError("Chat stream failed.", error);
          const errorMessage = error instanceof Error ? error.message : "The model stream failed.";
          if (assistantText.trim() && !assistantPersisted) {
            const estimatedCost = estimateModelCost({
              provider: usage.provider,
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens
            });
            const assistant = await createMessageWithNextSequence({
              chatId: chat.id,
              role: MessageRole.ASSISTANT,
              content: assistantText,
              model: usage.model,
              tokens: usage.outputTokens,
              provider: usage.provider,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              estimatedCost,
              usageEstimated: usage.usageEstimated,
              flagged: true
            });
            assistantPersisted = true;
            const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
            await prisma.chat.update({
              where: { id: chat.id },
              data: {
                messageCount: actualMessageCount,
                model,
                temperature,
                lastActiveAt: new Date(),
                updatedAt: new Date()
              }
            });
            send({ type: "message", message: assistant });
          } else {
            const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
            await prisma.chat.update({
              where: { id: chat.id },
              data: {
                messageCount: actualMessageCount,
                model,
                temperature,
                lastActiveAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          await syncChatTurns(chat.id, user.id).catch((storyError) => {
            logSafeError("Story turn sync failed after stream error.", storyError);
          });

          await prisma.llmRequestLog.create({
            data: {
              userId: user.id,
              chatId: chat.id,
              provider: usage.provider || "unknown",
              model: usage.model || model,
              route: "chat",
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              estimatedCost: estimateModelCost({
                provider: usage.provider,
                model: usage.model,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens
              }),
              status: assistantPersisted ? "partial_error" : "error",
              error: errorMessage.slice(0, 2000),
              latencyMs: Date.now() - started
            }
          });

          send({ type: "error", message: publicErrorMessage });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

function isMinor(birthDate: Date | null) {
  if (!birthDate) {
    return false;
  }

  const ageMs = Date.now() - birthDate.getTime();
  return ageMs < 18 * 365.25 * 24 * 60 * 60 * 1000;
}
