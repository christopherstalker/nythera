import "server-only";

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

type CounterRecord = {
  value: number;
  expiresAt: number;
};

const memoryCounters = new Map<string, CounterRecord>();

export const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

export function hasDistributedRateLimitStore() {
  return Boolean(redis);
}

export async function incrementWithExpiry(key: string, windowSeconds: number) {
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    return count;
  }

  const now = Date.now();
  const current = memoryCounters.get(key);
  if (!current || current.expiresAt <= now) {
    memoryCounters.set(key, {
      value: 1,
      expiresAt: now + windowSeconds * 1000
    });
    return 1;
  }

  current.value += 1;
  return current.value;
}
