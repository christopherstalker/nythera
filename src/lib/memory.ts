import "server-only";

import { MessageRole } from "@prisma/client";
import { enqueueJob } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { createMemory } from "@/lib/vector";

export async function schedulePostMessageJobs(input: {
  chatId: string;
  userId: string;
  characterId: string;
  latestUserMessage: string;
  latestAssistantMessage: string;
  messageCount: number;
}) {
  const queuedExtraction = await enqueueJob("extract-memories", input);
  const queuedSummary =
    input.messageCount > 30 && input.messageCount % 10 === 0
      ? await enqueueJob("summarize-chat", { chatId: input.chatId })
      : false;

  if (!queuedExtraction) {
    await opportunisticMemoryExtraction(input);
  }

  return { queuedExtraction, queuedSummary };
}

async function opportunisticMemoryExtraction(input: {
  chatId: string;
  userId: string;
  characterId: string;
  latestUserMessage: string;
  latestAssistantMessage: string;
}) {
  const stableFact = extractSimpleFact(input.latestUserMessage);
  if (!stableFact) {
    return null;
  }

  return createMemory({
    userId: input.userId,
    characterId: input.characterId,
    sourceChatId: input.chatId,
    content: stableFact,
    importance: 1.2
  });
}

function extractSimpleFact(message: string) {
  const match = message.match(/\b(my name is|i am|i'm|i like|i love|i prefer|i live in)\s+([^.!?]{2,140})/i);
  if (!match) {
    return null;
  }

  return `User said: ${match[0].trim()}`;
}

export async function summarizeChat(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 80
      }
    }
  });

  if (!chat) {
    return null;
  }

  const importantLines = chat.messages
    .filter((message) => message.role !== MessageRole.SYSTEM)
    .slice(-40)
    .map((message) => `${message.role}: ${message.content.slice(0, 240)}`);

  const summary = importantLines.join("\n").slice(-5000);

  return prisma.chat.update({
    where: { id: chatId },
    data: { summary }
  });
}
