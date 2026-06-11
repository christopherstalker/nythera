import "dotenv/config";

import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";
import { summarizeChat } from "@/lib/memory";

if (!env.REDIS_URL) {
  console.log("REDIS_URL is not set. Background worker is disabled.");
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
      // Production extraction should call a structured LLM endpoint.
      // The API route already performs opportunistic local extraction if Redis is absent.
      return;
    }

    if (job.name === "process-report") {
      return;
    }
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log(`Completed background job ${job.id} (${job.name})`);
});

worker.on("failed", (job, error) => {
  console.error(`Background job ${job?.id} failed`, error);
});
