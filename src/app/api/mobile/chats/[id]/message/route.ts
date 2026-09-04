import { MessageRole } from "@prisma/client";
import crypto from "crypto";
import { getRequestIp, HttpError, parseJson, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText } from "@/lib/safety";
import { detectPromptInjection } from "@/lib/prompt-security";
import { streamMessageSchema } from "@/lib/validation";
import { assembleNytheraPrompt } from "@/lib/prompt-assembly";
import { resolveCharacterPersona } from "@/lib/persona";
import { providerOutputTokenBudget, resolveChatOutputTokenLimit } from "@/lib/response-length";
import { loadAdaptiveChatHistory } from "@/lib/chat-history";
import { streamLlmResponse } from "@/lib/proxy";
import { getPromptMemories } from "@/lib/memory-store";
import { schedulePostMessageJobs, summarizeChat } from "@/lib/memory";
import { buildMemoryRetrievalQuery, conversationSummaryIsStale } from "@/lib/memory-policy";
import { getEffectiveProviderKeys, isUserOwnedProvider } from "@/lib/user-keys";
import { formatUserPersonaContinuitySource, formatUserPersonaForPrompt } from "@/lib/user-persona";
import { renderInitialChatGreeting } from "@/lib/character-prompt-contract";
import { createMessageWithNextSequence } from "@/lib/message-sequence";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { providerFallbackNotice } from "@/lib/provider-fallback";
import { estimateModelCost } from "@/lib/model-pricing";
import { logSafeError } from "@/lib/secret-redaction";
import { getStoryPromptContext, syncChatTurns } from "@/lib/stories/story-foundation";
import { markStoryBeatsCompleted, markStoryProactiveEventsFired } from "@/lib/stories/narrative-store";
import { buildFullPromptAddon } from "@/lib/prompts/buildPrompt";
import { formatTieredMemoryBlocks, getUserMemories, splitMemoriesForPrompt } from "@/lib/memory/promptBuilder";
import { normalizeChatMode } from "@/lib/chat-mode";
import { requireAdultConsent } from "@/lib/adult-consent";
import { schedulePostResponseTasks } from "@/lib/post-response";
import { containsRussianLanguage, RUSSIAN_LANGUAGE_ERROR } from "@/lib/language-policy";
import { buildSkipTimePrompt, resolveChatActionMessage, type SkipTimeDuration } from "@/lib/chat-actions";
import { continuationClientRequestId, skipTimeClientRequestId } from "@/lib/message-actions";
import { fitPromptMessagesWithinContext } from "@/lib/prompt-budget";

type Context = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: Context) {
  const started = Date.now();

  try {
    const user = await requireMobileUser(request);
    requireAdultConsent(user);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:chat:message"
    });

    const input = await parseJson(request, streamMessageSchema);
    const continueChat = input.continueChat === true;
    const skipTime = input.skipTime === true;
    const skipTimeDuration: SkipTimeDuration | null = input.skipTimeValue && input.skipTimeUnit
      ? { value: input.skipTimeValue, unit: input.skipTimeUnit }
      : null;
    const assistantOnlyAction = continueChat || skipTime;
    const continuationPrompt =
      "Continue the roleplay naturally from the immediately preceding selected assistant response. Do not speak as the user, do not invent a user reply, and keep the scene moving in the character's voice.";
    const actionMessage = resolveChatActionMessage(
      skipTime ? buildSkipTimePrompt(skipTimeDuration) : continueChat ? continuationPrompt : sanitizeUserText(input.message)
    );
    const message = actionMessage.promptContent;
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

    const chat = await prisma.chat.findFirst({
      where: {
        id: (await context.params).id,
        userId: user.id,
        archivedAt: null
      },
      include: {
        character: true,
        persona: true,
      }
    });

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
    const characterPersona = resolveCharacterPersona(chat.character);
    const maxOutputTokens = resolveChatOutputTokenLimit(
      characterPersona.verbosityLevel,
      effectiveSettings.maxTokens,
      user.maxOutputTokens
    );
    const providerMaxOutputTokens = providerOutputTokenBudget({
      visibleTokenLimit: maxOutputTokens,
      provider: effectiveSettings.provider,
      model
    });
    const temperature = effectiveSettings.temperature;
    if (!isUserOwnedProvider(effectiveSettings.provider, providerKeys)) {
      await enforceRateLimit({
        userId: user.id,
        ip: getRequestIp(request),
        route: "chat:token-budget",
        cost: Math.min(maxOutputTokens, 4096)
      });
    }
    const conversationSummary = conversationSummaryIsStale(chat)
      ? (await summarizeChat(chat.id))?.summary ?? chat.summary
      : chat.summary;
    const history = await loadAdaptiveChatHistory({
      chatId: chat.id,
      model,
      maxOutputTokens,
      currentMessage: message,
      summary: conversationSummary
    });
    const userMessage = assistantOnlyAction
      ? null
      : await createMessageWithNextSequence({
          chatId: chat.id,
          role: MessageRole.USER,
          content: actionMessage.persistedContent,
          clientRequestId: input.requestId
        });

    const [memories, userGlobalMemories, defaultUserPersona, storyContext] = await Promise.all([
      getPromptMemories({
        userId: user.id,
        characterId: chat.characterId,
        chatId: chat.id,
        query: buildMemoryRetrievalQuery(message, history.messages),
        semanticLimit: 8,
        totalLimit: 10,
        includeGlobal: false,
        providerKeys,
        semanticEnabled: user.memoryEnabled
      }),
      user.memoryEnabled ? getUserMemories(user.id, 8) : Promise.resolve([]),
      prisma.userPersona.findFirst({
        where: { userId: user.id, isDefault: true }
      }),
      getStoryPromptContext({ chatId: chat.id, userId: user.id, actorCharacterId: chat.characterId })
    ]);
    const userPersona = chat.persona ?? defaultUserPersona;
    const chatMode = normalizeChatMode(chat.chatMode);
    const { characterMemories, userMemories } = formatTieredMemoryBlocks(splitMemoriesForPrompt(memories, userGlobalMemories));
    const modeContext = buildFullPromptAddon({
      mode: chatMode,
      characterMemories,
      userMemories
    });
    const formattedUserPersona = formatUserPersonaForPrompt(userPersona);
    const recentMessages = history.messages.map((historyMessage) => renderInitialChatGreeting(
      historyMessage,
      chat.character.name,
      formattedUserPersona
    ));

    const assembledPrompt = assembleNytheraPrompt({
      character: chat.character,
      memories,
      userPersona: formattedUserPersona,
      userPersonaContinuity: formatUserPersonaContinuitySource(userPersona),
      summary: history.overflowed ? conversationSummary : null,
      recentMessages,
      currentMessage: message,
      responsePrompt: chat.responsePrompt,
      storyContext: storyContext.text,
      injectionAssessment,
      modeContext,
      memoryLimit: 10
    });
    const promptFit = fitPromptMessagesWithinContext(assembledPrompt, { model, maxOutputTokens: providerMaxOutputTokens });
    if (promptFit.fixedPromptTooLarge) {
      throw new HttpError(400, "System instructions exceed this model's context window. Choose a model with a larger context window or shorten the character system prompt.");
    }
    const prompt = promptFit.messages;
    const encoder = new TextEncoder();
    let assistantText = "";
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
            maxTokens: providerMaxOutputTokens,
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
              send(chunk);
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

          if (!assistantText.trim()) {
            throw new Error("The model returned an empty response.");
          }

          const estimatedCost = estimateModelCost({
            provider: usage.provider,
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens
          });

          const assistantMessage = await createMessageWithNextSequence({
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
            clientRequestId: assistantOnlyAction
              ? skipTime
                ? skipTimeClientRequestId(input.requestId || crypto.randomUUID(), input.continueMessageId, skipTimeDuration)
                : input.continueMessageId
                  ? continuationClientRequestId(input.requestId || crypto.randomUUID(), input.continueMessageId)
                  : `continue-${input.requestId || crypto.randomUUID()}`
              : undefined,
            branchSourceMessageId: assistantOnlyAction ? input.continueMessageId : undefined
          });
          assistantPersisted = true;

          const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
          const updated = await prisma.chat.update({
            where: { id: chat.id },
            data: {
              messageCount: actualMessageCount,
              model,
              temperature,
              lastActiveAt: new Date(),
              updatedAt: new Date()
            },
            select: { id: true, title: true, messageCount: true, lastActiveAt: true }
          });

          schedulePostResponseTasks("Mobile chat post-response", [
            {
              name: "request log",
              run: () => prisma.llmRequestLog.create({
                data: {
                  userId: user.id,
                  chatId: chat.id,
                  provider: usage.provider,
                  model: usage.model,
                  route: "mobile_chat",
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  estimatedCost,
                  status: outputBlocked ? "blocked_output" : usage.fallbackTriggered ? "ok_fallback" : "ok",
                  error: usage.fallbackTriggered ? `fallback attempts: ${(usage.attempts ?? []).join(" -> ")}`.slice(0, 2000) : null,
                  latencyMs: Date.now() - started
                }
              })
            },
            ...(user.memoryEnabled && !assistantOnlyAction
              ? [{
                  name: "memory jobs",
                  run: () => schedulePostMessageJobs({
                    chatId: chat.id,
                    userId: user.id,
                    characterId: chat.characterId,
                    latestUserMessage: message,
                    latestUserMessageId: userMessage?.id ?? null,
                    latestAssistantMessage: assistantMessage.content,
                    latestAssistantMessageId: assistantMessage.id,
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
                sourceMessageId: assistantMessage.id
              })
            },
            {
              name: "story beat completion",
              run: () => markStoryBeatsCompleted({
                beatIds: storyContext.beatIds,
                storyId: storyContext.storyId,
                sourceMessageId: assistantMessage.id
              })
            }
          ]);

          send({ type: "message", message: assistantMessage });
          send({ type: "done" });
        } catch (error) {
          logSafeError("Mobile chat stream failed.", error);
          const errorMessage = error instanceof Error ? error.message : "The model stream failed.";
          const estimatedCost = estimateModelCost({
            provider: usage.provider,
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens
          });

          if (assistantText.trim() && !assistantPersisted) {
            const assistantMessage = await createMessageWithNextSequence({
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
              clientRequestId: assistantOnlyAction
                ? skipTime
                  ? skipTimeClientRequestId(input.requestId || crypto.randomUUID(), input.continueMessageId, skipTimeDuration)
                  : input.continueMessageId
                    ? continuationClientRequestId(input.requestId || crypto.randomUUID(), input.continueMessageId)
                    : `continue-${input.requestId || crypto.randomUUID()}`
                : undefined,
              branchSourceMessageId: assistantOnlyAction ? input.continueMessageId : undefined
            });
            assistantPersisted = true;
            send({ type: "message", message: assistantMessage });
          }

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

          schedulePostResponseTasks("Mobile chat error post-response", [
            {
              name: "request log",
              run: () => prisma.llmRequestLog.create({
                data: {
                  userId: user.id,
                  chatId: chat.id,
                  provider: usage.provider || "unknown",
                  model: usage.model || model,
                  route: "mobile_chat",
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  estimatedCost,
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

  return Date.now() - birthDate.getTime() < 18 * 365.25 * 24 * 60 * 60 * 1000;
}
