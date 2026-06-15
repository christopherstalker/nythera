import { MessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, getRequestIp, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText } from "@/lib/safety";
import { detectPromptInjection } from "@/lib/prompt-security";
import { streamMessageSchema } from "@/lib/validation";
import { assembleCharacterPrompt } from "@/lib/prompts";
import { streamLlmResponse } from "@/lib/proxy";
import { searchMemories } from "@/lib/vector";
import { schedulePostMessageJobs } from "@/lib/memory";
import { generateChatTitle } from "@/lib/chat-history";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { formatUserPersonaForPrompt } from "@/lib/user-persona";
import { createMessageWithNextSequence } from "@/lib/message-sequence";

type Context = {
  params: {
    id: string;
  };
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: Context) {
  const started = Date.now();

  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chat:stream"
    });

    const input = await parseJson(request, streamMessageSchema);
    const message = sanitizeUserText(input.message);
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
        id: context.params.id,
        userId: user.id,
        archivedAt: null
      },
      include: {
        character: true,
        messages: {
          orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
          take: 40
        }
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

    const model = input.model ?? chat.model;
    const temperature = input.temperature ?? chat.temperature;

    const providerKeys = await getEffectiveProviderKeys(user.id);
    let recentMessages = chat.messages.reverse();

    if (input.regenerate) {
      let latestAssistantIndex = -1;
      for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
        if (recentMessages[index].role === MessageRole.ASSISTANT) {
          latestAssistantIndex = index;
          break;
        }
      }

      if (latestAssistantIndex >= 0) {
        let firstVariantIndex = latestAssistantIndex;
        while (firstVariantIndex > 0 && recentMessages[firstVariantIndex - 1].role === MessageRole.ASSISTANT) {
          firstVariantIndex -= 1;
        }

        recentMessages = recentMessages.filter((_, index) => index < firstVariantIndex || index > latestAssistantIndex);
      }
    } else {
      await createMessageWithNextSequence({
        chatId: chat.id,
        role: MessageRole.USER,
        content: message,
        clientRequestId: input.requestId
      });
    }

    const [memories, userPersona] = await Promise.all([
      user.memoryEnabled
        ? searchMemories({
            userId: user.id,
            characterId: chat.characterId,
            query: message,
            limit: 5,
            providerKeys
          })
        : Promise.resolve([]),
      prisma.userPersona.findUnique({
        where: { userId: user.id }
      })
    ]);

    const prompt = assembleCharacterPrompt({
      character: chat.character,
      memories,
      userPersona: formatUserPersonaForPrompt(userPersona),
      summary: chat.summary,
      recentMessages,
      currentMessage: message,
      injectionAssessment
    });

    const encoder = new TextEncoder();
    let assistantText = "";
    let outputBlocked = false;
    let assistantPersisted = false;
    let usage: {
      inputTokens: number;
      outputTokens: number;
      model: string;
      provider: string;
      latencyMs?: number;
      fallbackTriggered?: boolean;
      attempts?: string[];
    } = {
      inputTokens: 0,
      outputTokens: 0,
      model,
      provider: "unknown"
    };

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          for await (const chunk of streamLlmResponse({
            messages: prompt,
            model,
            temperature,
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
            }

            if (chunk.type === "error") {
              throw new Error(chunk.message);
            }
          }

          if (!assistantText.trim()) {
            throw new Error("The model returned an empty response.");
          }

          const assistant = await createMessageWithNextSequence({
            chatId: chat.id,
            role: MessageRole.ASSISTANT,
            content: assistantText,
            model: usage.model,
            tokens: usage.outputTokens,
            flagged: outputBlocked
          });
          assistantPersisted = true;
          const nextTitle =
            chat.title && chat.title !== chat.character.name
              ? chat.title
              : await generateChatTitle({
                  userMessage: message,
                  assistantMessage: assistantText,
                  model: usage.model || model,
                  providerKeys
                });

          const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
          const updated = await prisma.chat.update({
            where: { id: chat.id },
            data: {
              messageCount: actualMessageCount,
              title: nextTitle,
              model,
              temperature,
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
              status: outputBlocked ? "blocked_output" : usage.fallbackTriggered ? "ok_fallback" : "ok",
              error: usage.fallbackTriggered ? `fallback attempts: ${(usage.attempts ?? []).join(" -> ")}`.slice(0, 2000) : null,
              latencyMs: Date.now() - started
            }
          });

          if (user.memoryEnabled) {
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

          send({ type: "message", message: assistant });
          send({ type: "done" });
        } catch (error) {
          console.error(error);
          const errorMessage = error instanceof Error ? error.message : "The model stream failed.";
          if (assistantText.trim() && !assistantPersisted) {
            const assistant = await createMessageWithNextSequence({
              chatId: chat.id,
              role: MessageRole.ASSISTANT,
              content: assistantText,
              model: usage.model,
              tokens: usage.outputTokens,
              flagged: true
            });
            assistantPersisted = true;
            const nextTitle =
              chat.title && chat.title !== chat.character.name
                ? chat.title
                : await generateChatTitle({
                    userMessage: message,
                    assistantMessage: assistantText,
                    model: usage.model || model,
                    providerKeys
                  });
            const actualMessageCount = await prisma.message.count({ where: { chatId: chat.id } });
            await prisma.chat.update({
              where: { id: chat.id },
              data: {
                messageCount: actualMessageCount,
                title: nextTitle,
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
                title: chat.title && chat.title !== chat.character.name ? chat.title : message.slice(0, 54),
                model,
                temperature,
                lastActiveAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          await prisma.llmRequestLog.create({
            data: {
              userId: user.id,
              chatId: chat.id,
              provider: usage.provider || "unknown",
              model: usage.model || model,
              route: "chat",
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              status: assistantPersisted ? "partial_error" : "error",
              error: errorMessage.slice(0, 2000),
              latencyMs: Date.now() - started
            }
          });

          send({ type: "error", message: "The model stream failed." });
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
