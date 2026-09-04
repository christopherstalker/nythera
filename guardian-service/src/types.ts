export type GuardianStatus = "unknown" | "healthy" | "degraded" | "down";

export type CanaryCheck = {
  id: string;
  status: Exclude<GuardianStatus, "unknown">;
  checkedAt: string;
  durationMs: number;
  httpStatus: number | null;
  provider?: string;
  model?: string;
  fallbackTriggered?: boolean;
  attempts?: string[];
  reason?: string;
};

export type GuardianSnapshot = {
  status: GuardianStatus;
  checkedAt: string | null;
  changedAt: string | null;
  consecutiveFailures: number;
  lastCheck: CanaryCheck | null;
};

export const EMPTY_SNAPSHOT: GuardianSnapshot = {
  status: "unknown",
  checkedAt: null,
  changedAt: null,
  consecutiveFailures: 0,
  lastCheck: null
};
