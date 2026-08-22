import { MessageRole } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { HttpError, getRequestIp, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText } from "@/lib/safety";
import { detectPromptInjection, sanitizePromptContext } from "@/lib/prompt-security";
import { streamMessageSchema } from "@/lib/validation";
import { assembleNytheraPrompt } from "@/lib/prompt-assembly";
import { buildPromptAddonLayers, modeTemperature } from "@/lib/prompts/buildPrompt";
import { selectCustomPrompt } from "@/lib/response-prompt";
import { buildPhysicalMemoryContext, formatTieredMemoryBlocks, getUserMemories, splitMemoriesForPrompt } from "@/lib/memory/promptBuilder";
import { getPromptMemories } from "@/lib/memory-store";
import { normalizeChatMode } from "@/lib/chat-mode";
import { loadAdaptiveChatHistory } from "@/lib/chat-history";
import { streamLlmResponse } from "@/lib/proxy";
import { schedulePostMessageJobs } from "@/lib/memory";
import { getEffectiveProviderKeys, isUserOwnedProvider } from "@/lib/user-keys";
import { formatUserPersonaForPrompt } from "@/lib/user-persona";
import { createMessageWithNextSequence } from "@/lib/message-sequence";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { providerFallbackNotice } from "@/lib/provider-fallback";
import { continuationClientRequestId, prepareContinuationTurn, prepareRegenerationTurn, prepareUserRetryTurn } from "@/lib/message-actions";
import { getStoryPromptContext, syncChatTurns } from "@/lib/stories/story-foundation";
import { markStoryProactiveEventsFired } from "@/lib/stories/narrative-store";
import { estimateModelCost } from "@/lib/model-pricing";
import { elapsedMs, logPerformanceMetric, measurePrismaOperation, performanceStart } from "@/lib/performance-logger";
import { logSafeError } from "@/lib/secret-redaction";
import { requireAdultConsent } from "@/lib/adult-consent";
import { schedulePostResponseTasks } from "@/lib/post-response";
import { resolveCharacterPersona } from "@/lib/persona";
import { maxOutputTokensForVerbosity } from "@/lib/response-length";
import { loadPromptImages, resolveOwnedChatAssets, serializeAsset } from "@/lib/chat-media";
import { containsRussianLanguage, RUSSIAN_LANGUAGE_ERROR } from "@/lib/language-policy";
import { createPhysicalContinuityOutputGuard } from "@/lib/physical-continuity";

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
    requireAdultConsent(user);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chat:stream"
    });

    const input = await parseJson(request, streamMessageSchema);
    const continueChat = input.continueChat === true;
    const continuationPrompt =
      "Continue the roleplay naturally from the immediately preceding selected assistant response. Do not speak as the user, do not invent a user reply, and keep the scene moving in the character's voice.";
    let message = continueChat ? continuationPrompt : sanitizeUserText(input.message);
    let branchInstruction: string | null = null;
    let resolvedBranchMessageId: string | null = null;

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
            temporaryPersona: true,
          }
        }),
      (result) => ({
        found: Boolean(result),
        messageCount: result?.messageCount ?? 0
      })
    );

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const attachedAssets = await resolveOwnedChatAssets({
      assetIds: input.attachmentIds,
      chatId: chat.id,
      userId: user.id
    });

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
    const characterPersona = resolveCharacterPersona(chat.character);
    const maxOutputTokens = maxOutputTokensForVerbosity(characterPersona.verbosityLevel, effectiveSettings.maxTokens);
    let temperature = effectiveSettings.temperature;
    if (!isUserOwnedProvider(effectiveSettings.provider, providerKeys)) {
      await enforceRateLimit({
        userId: user.id,
        ip: getRequestIp(request),
        route: "chat:token-budget",
        cost: Math.min(maxOutputTokens, 4096)
      });
    }
    const history = await loadAdaptiveChatHistory({
      chatId: chat.id,
      model,
      maxOutputTokens,
      currentMessage: message,
      summary: chat.summary
    });
    let recentMessages = history.messages.slice(-20);
    let userMessage: Awaited<ReturnType<typeof createMessageWithNextSequence>> | null = null;

    if (input.retryUserMessageId) {
      const retryTurn = prepareUserRetryTurn(recentMessages, input.retryUserMessageId);
      if (!retryTurn) {
        throw new HttpError(409, "That message already has a response. Refresh the chat to see it.");
      }

      message = sanitizeUserText(retryTurn.currentMessage ?? "");
      recentMessages = retryTurn.recentMessages;
    } else if (input.regenerate) {
      const regenerationTurn = prepareRegenerationTurn(recentMessages, input.regenerateMessageId);
      if (!regenerationTurn) {
        throw new HttpError(409, "Only the latest assistant response can be regenerated. Rewind or branch from an earlier turn.");
      }

      message = regenerationTurn.trigger === "user"
        ? sanitizeUserText(regenerationTurn.currentMessage ?? "")
        : regenerationTurn.trigger === "continuation"
          ? continuationPrompt
          : "Write a fresh alternative opening message for this roleplay. Stay in character, establish the scene, and leave room for the user to respond.";
      recentMessages = regenerationTurn.recentMessages;
    } else if (continueChat && input.continueMessageId) {
      const continuationMessages = prepareContinuationTurn(recentMessages, input.continueMessageId);
      if (!continuationMessages) {
        throw new HttpError(409, "That response is no longer available to continue. Refresh the chat and try again.");
      }
      recentMessages = continuationMessages;
      const selectedResponse = continuationMessages.at(-1)?.content ?? "";
      branchInstruction = `The selected response quoted below is the only valid branch. Ignore every sibling regeneration, even if it was created later. Continue directly from this exact response:\n<selected_response>\n${sanitizePromptContext(selectedResponse, 1800)}\n</selected_response>`;
    } else if (input.branchMessageId) {
      const branchMessages = prepareContinuationTurn(recentMessages, input.branchMessageId);
      if (branchMessages) {
        recentMessages = branchMessages;
        resolvedBranchMessageId = input.branchMessageId;
        const selectedResponse = branchMessages.at(-1)?.content ?? "";
        branchInstruction = `The selected response quoted below is the only valid branch. Ignore every sibling regeneration, even if it was created later. Continue directly from this exact response:\n<selected_response>\n${sanitizePromptContext(selectedResponse, 1800)}\n</selected_response>`;
      }
    }

    if (containsRussianLanguage(message)) {
      throw new HttpError(400, RUSSIAN_LANGUAGE_ERROR);
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

    if (!input.regenerate && !input.retryUserMessageId && !continueChat) {
      userMessage = await createMessageWithNextSequence({
        chatId: chat.id,
        role: MessageRole.USER,
        content: message,
        clientRequestId: input.requestId,
        branchSourceMessageId: resolvedBranchMessageId
      });
      if (attachedAssets.length) {
        await prisma.messageAttachment.createMany({
          data: attachedAssets.map((asset, position) => ({
            messageId: userMessage!.id,
            assetId: asset.id,
            position
          }))
        });
      }
    }

    const [memories, userGlobalMemories, defaultUserPersona, storyContext] = await Promise.all([
      getPromptMemories({
        userId: user.id,
        characterId: chat.characterId,
        query: message,
        totalLimit: 5,
        includeGlobal: false,
        providerKeys,
        semanticEnabled: user.memoryEnabled
      }),
      user.memoryEnabled ? getUserMemories(user.id, 8) : Promise.resolve([]),
      prisma.userPersona.findFirst({
        where: { userId: user.id, isDefault: true }
      }),
      getStoryPromptContext({
        chatId: chat.id,
        userId: user.id,
        actorCharacterId: chat.characterId,
        includeCheckpoint: !branchInstruction
      })
    ]);
    const userPersona = chat.temporaryPersona ?? chat.persona ?? defaultUserPersona;
    const chatMode = normalizeChatMode(chat.chatMode);
    const tieredMemories = splitMemoriesForPrompt(memories, userGlobalMemories);
    const { characterMemories, userMemories } = formatTieredMemoryBlocks(tieredMemories);
    const responsePrompt = input.responsePrompt ?? chat.responsePrompt;
    const customPromptActive = Boolean(selectCustomPrompt(responsePrompt, effectiveSettings.systemPromptOverride));
    const userPersonaPrompt = formatUserPersonaForPrompt(userPersona);
    const physicalContext = buildPhysicalMemoryContext(chat.summary, [...memories, ...userGlobalMemories]);
    const promptAddon = buildPromptAddonLayers({
      mode: chatMode,
      characterMemories,
      userMemories
    });

    const currentImages = await loadPromptImages(attachedAssets);
    const prompt = assembleNytheraPrompt({
      character: chat.character,
      memories,
      userPersona: userPersonaPrompt,
      summary: history.overflowed && !branchInstruction ? chat.summary : null,
      recentMessages,
      currentMessage: message,
      currentImages,
      responsePrompt,
      storyContext: storyContext.text,
      factualStoryContext: storyContext.factualText,
      injectionAssessment,
      branchInstruction,
      modeContext: promptAddon.modeStyle,
      sessionMemoryContext: promptAddon.sessionMemory,
      physicalContext,
      translationLanguage: chat.translationLanguage
    });
    const physicalOutputGuard = createPhysicalContinuityOutputGuard(
      chat.character,
      userPersonaPrompt,
      { recentMessages, currentMessage: message, persistentPlayerContext: physicalContext },
      { enabled: !customPromptActive }
    );

    temperature = customPromptActive ? effectiveSettings.temperature : modeTemperature(chatMode, effectiveSettings.temperature);

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
        let clientConnected = !request.signal.aborted;
        const send = (payload: unknown) => {
          if (!clientConnected || request.signal.aborted) {
            clientConnected = false;
            return;
          }

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            clientConnected = false;
          }
        };
        const appendAssistantDelta = (text: string) => {
          if (!text) return true;
          const nextText = assistantText + text;
          const check = moderateText({
            text: nextText,
            userIsMinor: isMinor(user.birthDate),
            context: "assistant"
          });

          if (!check.allowed) {
            outputBlocked = true;
            const replacement = check.reason ?? "The response was stopped because it did not pass the platform safety policy.";
            assistantText = replacement;
            send({ type: "delta", text: replacement });
            return false;
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
          send({ type: "delta", text });
          return true;
        };

        try {
          if (userMessage) {
            send({
              type: "user_message",
              message: {
                ...userMessage,
                attachments: attachedAssets.map(serializeAsset)
              }
            });
          }

          for await (const chunk of streamLlmResponse({
            messages: prompt,
            model,
            temperature,
            topP: effectiveSettings.topP,
            frequencyPenalty: effectiveSettings.frequencyPenalty,
            presencePenalty: effectiveSettings.presencePenalty,
            maxTokens: maxOutputTokens,
            userId: user.id,
            chatId: chat.id,
            providerKeys,
            signal: request.signal
          })) {
            if (chunk.type === "delta") {
              const guardedDelta = physicalOutputGuard.push(chunk.text);
              if (guardedDelta && !appendAssistantDelta(guardedDelta)) break;
            }

            if (chunk.type === "usage") {
              usage = chunk;
              const notice = chunk.fallbackTriggered ? providerFallbackNotice(chunk.attempts) : null;
              if (notice) send({ type: "provider_notice", message: notice });
            }

            if (chunk.type === "error") {
              publicErrorMessage = chunk.message;
              throw new Error(chunk.message);
            }
          }
          if (!outputBlocked) appendAssistantDelta(physicalOutputGuard.flush());

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
            clientRequestId: continueChat && input.continueMessageId
              ? continuationClientRequestId(input.requestId || crypto.randomUUID(), input.continueMessageId)
              : continueChat
                ? `continue-${input.requestId || crypto.randomUUID()}`
                : undefined,
            branchSourceMessageId: continueChat ? input.continueMessageId : undefined
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
              summary: continueChat ? null : undefined,
              summaryThroughSequence: continueChat ? 0 : undefined,
              activeAssistantMessageId: assistant.id,
              temporaryPersonaId: chat.temporaryPersonaId ? null : undefined,
              lastActiveAt: new Date(),
              updatedAt: new Date()
            },
            select: { messageCount: true }
          });

          schedulePostResponseTasks("Chat post-response", [
            {
              name: "request log",
              run: () => prisma.llmRequestLog.create({
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
              })
            },
            ...(user.memoryEnabled && !continueChat
              ? [{
                  name: "memory jobs",
                  run: () => schedulePostMessageJobs({
                    chatId: chat.id,
                    userId: user.id,
                    characterId: chat.characterId,
                    latestUserMessage: message,
                    latestUserMessageId: userMessage?.id ?? input.retryUserMessageId ?? null,
                    latestAssistantMessage: assistant.content,
                    latestAssistantMessageId: assistant.id,
                    messageCount: updated.messageCount,
                    providerKeys
                  })
                }]
              : []),
            { name: "story sync", run: () => syncChatTurns(chat.id, user.id) },
            {
              name: "story event completion",
              run: () => markStoryProactiveEventsFired({
                eventIds: storyContext.eventIds,
                storyId: storyContext.storyId,
                sourceMessageId: assistant.id
              })
            }
          ]);

          send({ type: "message", message: assistant });
          send({ type: "done" });
        } catch (error) {
          if (!outputBlocked) appendAssistantDelta(physicalOutputGuard.flush());
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
              flagged: true,
              clientRequestId: continueChat && input.continueMessageId
                ? continuationClientRequestId(input.requestId || crypto.randomUUID(), input.continueMessageId)
                : continueChat
                  ? `continue-${input.requestId || crypto.randomUUID()}`
                  : undefined,
              branchSourceMessageId: continueChat ? input.continueMessageId : undefined
            });
            assistantPersisted = true;
            const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
            await prisma.chat.update({
              where: { id: chat.id },
              data: {
                messageCount: actualMessageCount,
                model,
                temperature,
                summary: continueChat ? null : undefined,
                summaryThroughSequence: continueChat ? 0 : undefined,
                activeAssistantMessageId: assistant.id,
                temporaryPersonaId: chat.temporaryPersonaId ? null : undefined,
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

          schedulePostResponseTasks("Chat error post-response", [
            { name: "story sync", run: () => syncChatTurns(chat.id, user.id) },
            {
              name: "request log",
              run: () => prisma.llmRequestLog.create({
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
              })
            }
          ]);

          send({ type: "error", message: publicErrorMessage });
        } finally {
          if (clientConnected) {
            try {
              controller.close();
            } catch {
              // The client already closed the stream.
            }
          }
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
