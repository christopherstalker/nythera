import { MessageRole } from "@prisma/client";
import crypto from "crypto";
import { getRequestIp, HttpError, json, parseJson, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateText, sanitizeUserText } from "@/lib/safety";
import { detectPromptInjection } from "@/lib/prompt-security";
import { streamMessageSchema } from "@/lib/validation";
import { assembleNytheraPrompt } from "@/lib/prompt-assembly";
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
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: Context) {
  const started = Date.now();

  try {
    const user = await requireMobileUser(request);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:chat:message"
    });

    const input = await parseJson(request, streamMessageSchema);
    const continueChat = input.continueChat === true;
    const continuationPrompt =
      "Continue the roleplay naturally from the latest message. Do not speak as the user, do not invent a user reply, and keep the scene moving in the character's voice.";
    const message = continueChat ? continuationPrompt : sanitizeUserText(input.message);
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
    const latestHistoryContent = chat.messages[0]?.content ?? message;

    const userMessage = continueChat
      ? null
      : await createMessageWithNextSequence({
          chatId: chat.id,
          role: MessageRole.USER,
          content: message,
          clientRequestId: input.requestId
        });

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

    const prompt = assembleNytheraPrompt({
      character: chat.character,
      memories,
      userPersona: formatUserPersonaForPrompt(userPersona),
      summary: chat.summary,
      recentMessages: [...chat.messages].reverse(),
      currentMessage: message,
      responsePrompt: chat.responsePrompt,
      injectionAssessment
    });

    let assistantText = "";
    let outputBlocked = false;
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
          assistantText = check.reason ?? "The response was stopped because it did not pass the platform safety policy.";
          break;
        }

        assistantText = nextText;
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

    const assistantMessage = await createMessageWithNextSequence({
      chatId: chat.id,
      role: MessageRole.ASSISTANT,
      content: assistantText,
      model: usage.model,
      tokens: usage.outputTokens,
      flagged: outputBlocked,
      clientRequestId: continueChat ? `continue-${input.requestId || crypto.randomUUID()}` : undefined
    });

    const nextTitle =
      chat.title && chat.title !== chat.character.name
        ? chat.title
        : await generateChatTitle({
            userMessage: continueChat ? latestHistoryContent : message,
            assistantMessage: assistantText,
            model: usage.model || model,
            providerKeys
          });

    const updated = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        messageCount: await prisma.message.count({ where: { chatId: chat.id } }),
        title: nextTitle,
        model,
        temperature,
        lastActiveAt: new Date(),
        updatedAt: new Date()
      },
      select: { id: true, title: true, messageCount: true, lastActiveAt: true }
    });

    await prisma.llmRequestLog.create({
      data: {
        userId: user.id,
        chatId: chat.id,
        provider: usage.provider,
        model: usage.model,
        route: "mobile_chat",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
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
        latestAssistantMessage: assistantMessage.content,
        messageCount: updated.messageCount,
        providerKeys
      });
    }

    return json({ chat: updated, userMessage, assistantMessage });
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
