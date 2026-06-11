import { MessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, getRequestIp, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText } from "@/lib/safety";
import { streamMessageSchema } from "@/lib/validation";
import { assembleCharacterPrompt } from "@/lib/prompts";
import { streamLlmResponse } from "@/lib/proxy";
import { searchMemories } from "@/lib/vector";
import { schedulePostMessageJobs } from "@/lib/memory";
import { titleFromMessage } from "@/lib/utils";
import { getDecryptedProviderKeys } from "@/lib/user-keys";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "chat:stream"
    });

    const input = await parseJson(request, streamMessageSchema);
    const message = sanitizeUserText(input.message);
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
          orderBy: { createdAt: "desc" },
          take: 20
        }
      }
    });

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const model = input.model ?? chat.model;
    const temperature = input.temperature ?? chat.temperature;

    const providerKeys = await getDecryptedProviderKeys(user.id);
    const [memories] = await Promise.all([
      searchMemories({
        userId: user.id,
        characterId: chat.characterId,
        query: message,
        limit: 5,
        providerKeys
      }),
      prisma.message.create({
        data: {
          chatId: chat.id,
          role: MessageRole.USER,
          content: message
        }
      })
    ]);

    const prompt = assembleCharacterPrompt({
      character: chat.character,
      memories,
      summary: chat.summary,
      recentMessages: chat.messages.reverse(),
      currentMessage: message
    });

    const encoder = new TextEncoder();
    let assistantText = "";
    let outputBlocked = false;
    let usage = {
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
            providerKeys
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
          }

          const assistant = await prisma.message.create({
            data: {
              chatId: chat.id,
              role: MessageRole.ASSISTANT,
              content: assistantText,
              model: usage.model,
              tokens: usage.outputTokens,
              flagged: outputBlocked
            }
          });

          const updated = await prisma.chat.update({
            where: { id: chat.id },
            data: {
              messageCount: { increment: 2 },
              title: chat.title || titleFromMessage(message),
              model,
              temperature,
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
              status: outputBlocked ? "blocked_output" : "ok"
            }
          });

          await schedulePostMessageJobs({
            chatId: chat.id,
            userId: user.id,
            characterId: chat.characterId,
            latestUserMessage: message,
            latestAssistantMessage: assistant.content,
            messageCount: updated.messageCount
          });

          send({ type: "message", message: assistant });
          send({ type: "done" });
        } catch (error) {
          console.error(error);
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
