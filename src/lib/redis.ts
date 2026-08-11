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

export async function incrementWithExpiry(key: string, windowSeconds: number, amount = 1) {
  if (redis) {
    return redis.eval<[number, number], number>(
      "local count = redis.call('INCRBY', KEYS[1], ARGV[1]); if count == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], ARGV[2]); end; return count",
      [key],
      [amount, windowSeconds]
    );
  }

  const now = Date.now();
  const current = memoryCounters.get(key);
  if (!current || current.expiresAt <= now) {
    memoryCounters.set(key, {
      value: amount,
      expiresAt: now + windowSeconds * 1000
    });
    return 1;
  }

  current.value += amount;
  return current.value;
}
