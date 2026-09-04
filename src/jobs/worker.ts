import "dotenv/config";

import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";
import { extractMemoriesFromExchange, summarizeChat } from "@/lib/memory";
import { extractMemoriesWithLlm } from "@/lib/memory/extract";
import { getEffectiveProviderKeys } from "@/lib/user-keys";

if (!env.REDIS_URL) {
  process.exit(0);
}

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const worker = new Worker(
  "roleplay-background",
  async (job) => {
    if (job.name === "summarize-chat") {
      await summarizeChat(String(job.data.chatId));
      return;
    }

    if (job.name === "extract-memories") {
      const exchange = {
        chatId: String(job.data.chatId),
        userId: String(job.data.userId),
        characterId: String(job.data.characterId),
        latestUserMessage: String(job.data.latestUserMessage ?? ""),
        latestUserMessageId: job.data.latestUserMessageId ? String(job.data.latestUserMessageId) : null,
        latestAssistantMessage: String(job.data.latestAssistantMessage ?? ""),
        latestAssistantMessageId: String(job.data.latestAssistantMessageId ?? "")
      };
      const providerKeys = await getEffectiveProviderKeys(exchange.userId);
      await extractMemoriesFromExchange({ ...exchange, providerKeys });
      await extractMemoriesWithLlm({
        userId: exchange.userId,
        characterId: exchange.characterId,
        chatId: exchange.chatId,
        sourceMessageId: exchange.latestAssistantMessageId,
        userMessage: exchange.latestUserMessage,
        assistantMessage: exchange.latestAssistantMessage,
        providerKeys
      });
      return;
    }

    if (job.name === "process-report") {
      return;
    }
  },
  { connection: connection as never }
);

worker.on("failed", (job, error) => {
  console.error(`Background job ${job?.id} failed`, error);
});
