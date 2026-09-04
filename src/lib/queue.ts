import "server-only";

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

export type JobName = "extract-memories" | "summarize-chat" | "process-report";

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

const connection = env.REDIS_URL && !isProductionBuild
  ? new IORedis(env.REDIS_URL, {
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => attempt <= 1 ? 250 : null
    })
  : null;

let connectionErrorReported = false;
function reportConnectionError(error: Error) {
  if (connectionErrorReported) return;
  connectionErrorReported = true;
  console.warn("Redis background queue connection failed.", error.message);
}

connection?.on("error", reportConnectionError);
connection?.on("ready", () => {
  connectionErrorReported = false;
});

export const backgroundQueue = connection
  ? new Queue("roleplay-background", { connection: connection as never })
  : null;
backgroundQueue?.on("error", reportConnectionError);

export async function enqueueJob(name: JobName, data: Record<string, unknown>) {
  if (!backgroundQueue) {
    return false;
  }

  try {
    await backgroundQueue.add(name, data, {
      removeOnComplete: 250,
      removeOnFail: 1000,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000
      }
    });
  } catch (error) {
    console.warn("Background queue unavailable; running inline fallback.", error);
    return false;
  }

  return true;
}
