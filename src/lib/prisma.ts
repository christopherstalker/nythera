import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";

export type PrismaQueryMetrics = {
  queryCount: number;
  queryTimeMs: number;
};

const prismaQueryMetrics = new AsyncLocalStorage<PrismaQueryMetrics>();

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"]
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const startedAt = performance.now();

          try {
            return await query(args);
          } finally {
            const metrics = prismaQueryMetrics.getStore();
            if (metrics) {
              metrics.queryCount += 1;
              metrics.queryTimeMs += performance.now() - startedAt;
            }
          }
        }
      }
    }
  });

  return client as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function runWithPrismaQueryMetrics<T>(operation: () => Promise<T>) {
  return prismaQueryMetrics.run({ queryCount: 0, queryTimeMs: 0 }, operation);
}

export function readPrismaQueryMetrics(): PrismaQueryMetrics {
  const metrics = prismaQueryMetrics.getStore();
  return metrics ? { ...metrics } : { queryCount: 0, queryTimeMs: 0 };
}
