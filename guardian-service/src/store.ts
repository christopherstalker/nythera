import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import type { GuardianConfig } from "./config.js";
import { EMPTY_SNAPSHOT, type CanaryCheck, type GuardianSnapshot } from "./types.js";

const SNAPSHOT_KEY = "guardian:monitor:v1:snapshot";
const HISTORY_KEY = "guardian:monitor:v1:history";
const LOCK_KEY = "guardian:monitor:v1:check-lock";
const HISTORY_LIMIT = 100;

export class GuardianStore {
  private readonly redis: Redis | null;
  private memorySnapshot: GuardianSnapshot = EMPTY_SNAPSHOT;
  private memoryLock: string | null = null;

  constructor(config: GuardianConfig) {
    this.redis = config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: config.UPSTASH_REDIS_REST_URL, token: config.UPSTASH_REDIS_REST_TOKEN })
      : null;
  }

  distributed() {
    return this.redis !== null;
  }

  async readSnapshot() {
    if (!this.redis) return this.memorySnapshot;
    try {
      return await this.redis.get<GuardianSnapshot>(SNAPSHOT_KEY) ?? this.memorySnapshot;
    } catch (error) {
      logStoreFailure("read", error);
      return this.memorySnapshot;
    }
  }

  async save(snapshot: GuardianSnapshot, check: CanaryCheck) {
    this.memorySnapshot = snapshot;
    if (!this.redis) return;

    const pipeline = this.redis.pipeline();
    pipeline.set(SNAPSHOT_KEY, snapshot);
    pipeline.lpush(HISTORY_KEY, check);
    pipeline.ltrim(HISTORY_KEY, 0, HISTORY_LIMIT - 1);
    try {
      await pipeline.exec();
    } catch (error) {
      logStoreFailure("save", error);
    }
  }

  async acquireLock(ttlSeconds: number) {
    const token = randomUUID();
    if (!this.redis) {
      if (this.memoryLock) return null;
      this.memoryLock = token;
      return token;
    }

    try {
      const acquired = await this.redis.set(LOCK_KEY, token, { nx: true, ex: ttlSeconds });
      return acquired === "OK" ? token : null;
    } catch (error) {
      logStoreFailure("lock", error);
      if (this.memoryLock) return null;
      this.memoryLock = token;
      return token;
    }
  }

  async releaseLock(token: string) {
    if (!this.redis) {
      if (this.memoryLock === token) this.memoryLock = null;
      return;
    }

    try {
      await this.redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        [LOCK_KEY],
        [token]
      );
    } catch (error) {
      logStoreFailure("unlock", error);
    }
    if (this.memoryLock === token) this.memoryLock = null;
  }
}

function logStoreFailure(operation: string, error: unknown) {
  console.warn(JSON.stringify({
    level: "warn",
    event: "guardian_store_error",
    operation,
    error: error instanceof Error ? error.message : String(error)
  }));
}
