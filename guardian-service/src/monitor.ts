import { randomUUID } from "crypto";
import type { Logger } from "pino";
import type { GuardianConfig } from "./config.js";
import { GuardianNotifier } from "./notifier.js";
import { GuardianStore } from "./store.js";
import type { CanaryCheck, GuardianSnapshot } from "./types.js";

type CanaryPayload = {
  ok?: boolean;
  status?: string;
  provider?: string;
  model?: string;
  fallbackTriggered?: boolean;
  attempts?: string[];
  durationMs?: number;
  error?: string;
};

export class GuardianMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: GuardianConfig,
    private readonly store: GuardianStore,
    private readonly notifier: GuardianNotifier,
    private readonly logger: Logger
  ) {}

  start() {
    void this.check("startup");
    this.timer = setInterval(() => void this.check("schedule"), this.config.GUARDIAN_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async snapshot() {
    return this.store.readSnapshot();
  }

  async check(trigger: "startup" | "schedule" | "manual") {
    const lockTtlSeconds = Math.ceil(this.config.GUARDIAN_TIMEOUT_MS / 1000) + 10;
    const lockToken = await this.store.acquireLock(lockTtlSeconds);
    if (!lockToken) {
      this.logger.info({ event: "guardian_check_skipped", trigger, reason: "already_running" });
      return this.store.readSnapshot();
    }

    const startedAt = Date.now();
    try {
      const previous = await this.store.readSnapshot();
      const check = await this.runCanary(startedAt);
      const current = advanceSnapshot(previous, check);
      await this.store.save(current, check);

      this.logger[check.status === "down" ? "error" : check.status === "degraded" ? "warn" : "info"]({
        event: "guardian_check_complete",
        trigger,
        ...check
      });

      if (previous.status !== "unknown" && previous.status !== current.status) {
        await this.notifier.send(previous, current);
      }
      return current;
    } finally {
      await this.store.releaseLock(lockToken).catch((error) => {
        this.logger.warn({ event: "guardian_lock_release_failed", error: safeMessage(error) });
      });
    }
  }

  private async runCanary(startedAt: number): Promise<CanaryCheck> {
    const id = randomUUID();
    const checkedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.GUARDIAN_TIMEOUT_MS);

    try {
      const response = await fetch(new URL("/api/internal/guardian/canary", this.config.GUARDIAN_TARGET_URL), {
        headers: {
          authorization: `Bearer ${this.config.GUARDIAN_SHARED_SECRET}`,
          "user-agent": "Nythera-Guardian/1.0",
          "x-guardian-check-id": id
        },
        cache: "no-store",
        signal: controller.signal
      });
      const payload = await readPayload(response);
      const durationMs = Date.now() - startedAt;

      if (!response.ok || !payload.ok) {
        return {
          id,
          status: "down",
          checkedAt,
          durationMs,
          httpStatus: response.status,
          reason: payload.error ?? `Canary returned HTTP ${response.status}.`
        };
      }

      const degraded = payload.fallbackTriggered === true || payload.status === "degraded" || durationMs > this.config.GUARDIAN_SLOW_RESPONSE_MS;
      return {
        id,
        status: degraded ? "degraded" : "healthy",
        checkedAt,
        durationMs,
        httpStatus: response.status,
        provider: payload.provider,
        model: payload.model,
        fallbackTriggered: payload.fallbackTriggered ?? false,
        attempts: payload.attempts ?? [],
        reason: durationMs > this.config.GUARDIAN_SLOW_RESPONSE_MS ? "Canary response exceeded the latency threshold." : undefined
      };
    } catch (error) {
      return {
        id,
        status: "down",
        checkedAt,
        durationMs: Date.now() - startedAt,
        httpStatus: null,
        reason: error instanceof DOMException && error.name === "AbortError"
          ? "Canary request timed out."
          : safeMessage(error)
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function advanceSnapshot(previous: GuardianSnapshot, check: CanaryCheck): GuardianSnapshot {
  const consecutiveFailures = check.status === "healthy" ? 0 : previous.consecutiveFailures + 1;
  const status = check.status === "down" && consecutiveFailures < 2 ? "degraded" : check.status;
  const changed = previous.status !== status;
  return {
    status,
    checkedAt: check.checkedAt,
    changedAt: changed ? check.checkedAt : previous.changedAt,
    consecutiveFailures,
    lastCheck: check
  };
}

async function readPayload(response: Response): Promise<CanaryPayload> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return {};
  const payload = await response.json().catch(() => null);
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as CanaryPayload : {};
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
