import "server-only";

import { readPrismaQueryMetrics, runWithPrismaQueryMetrics } from "@/lib/prisma";
import { redactForLog } from "@/lib/secret-redaction";

type PerformanceFields = Record<string, unknown>;

export function performanceStart() {
  return performance.now();
}

export function elapsedMs(startedAt: number) {
  return roundMs(performance.now() - startedAt);
}

export function logPerformanceMetric(event: string, fields: PerformanceFields) {
  const payload = redactForLog({
    event,
    ...fields,
    timestamp: new Date().toISOString()
  });

  console.info("[perf]", JSON.stringify(payload));
}

export async function measurePrismaOperation<T>(
  fields: PerformanceFields,
  operation: () => Promise<T>,
  summarize?: (result: T) => PerformanceFields
) {
  const startedAt = performanceStart();
  let metrics = { queryCount: 0, queryTimeMs: 0 };

  try {
    const result = await runWithPrismaQueryMetrics(async () => {
      try {
        return await operation();
      } finally {
        metrics = readPrismaQueryMetrics();
      }
    });

    logPerformanceMetric("db_query", {
      ...fields,
      success: true,
      durationMs: elapsedMs(startedAt),
      queryCount: metrics.queryCount,
      queryTimeMs: roundMs(metrics.queryTimeMs),
      ...(summarize?.(result) ?? {})
    });

    return result;
  } catch (error) {
    logPerformanceMetric("db_query", {
      ...fields,
      success: false,
      durationMs: elapsedMs(startedAt),
      queryCount: metrics.queryCount,
      queryTimeMs: roundMs(metrics.queryTimeMs)
    });
    throw error;
  }
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}
