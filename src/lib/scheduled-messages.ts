export const SCHEDULED_EVENTS_CHANGED_EVENT = "nythera:scheduled-events-changed";

const MIN_CHECK_DELAY_MS = 1_000;
const MAX_CHECK_DELAY_MS = 2_147_483_647;

export function getScheduledMessageDelay(nextTriggerAt: unknown, now = Date.now()) {
  if (typeof nextTriggerAt !== "string") {
    return null;
  }

  const triggerTime = Date.parse(nextTriggerAt);
  if (!Number.isFinite(triggerTime)) {
    return null;
  }

  return Math.min(MAX_CHECK_DELAY_MS, Math.max(MIN_CHECK_DELAY_MS, triggerTime - now));
}
