import "server-only";

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

export type JobName = "extract-memories" | "summarize-chat" | "process-report";

const connection = env.REDIS_URL
  ? new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    })
  : null;

export const backgroundQueue = connection
  ? new Queue("roleplay-background", { connection: connection as never })
  : null;

export async function enqueueJob(name: JobName, data: Record<string, unknown>) {
  if (!backgroundQueue) {
    return false;
  }

  await backgroundQueue.add(name, data, {
    removeOnComplete: 250,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    }
  });

  return true;
}
