import type { Logger } from "pino";
import type { GuardianConfig } from "./config.js";
import type { GuardianSnapshot } from "./types.js";

export class GuardianNotifier {
  constructor(
    private readonly config: GuardianConfig,
    private readonly logger: Logger
  ) {}

  async send(previous: GuardianSnapshot, current: GuardianSnapshot) {
    const message = formatMessage(previous, current);
    const notifications: Promise<unknown>[] = [];

    if (this.config.GUARDIAN_ALERT_WEBHOOK_URL) {
      notifications.push(fetch(this.config.GUARDIAN_ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "nythera_guardian_status_changed", previous: previous.status, current }),
        signal: AbortSignal.timeout(10_000)
      }).then(assertSuccessfulNotification));
    }

    if (this.config.GUARDIAN_TELEGRAM_BOT_TOKEN && this.config.GUARDIAN_TELEGRAM_CHAT_ID) {
      notifications.push(fetch(`https://api.telegram.org/bot${this.config.GUARDIAN_TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: this.config.GUARDIAN_TELEGRAM_CHAT_ID, text: message }),
        signal: AbortSignal.timeout(10_000)
      }).then(assertSuccessfulNotification));
    }

    const outcomes = await Promise.allSettled(notifications);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        this.logger.warn({ event: "guardian_notification_failed", error: safeMessage(outcome.reason) });
      }
    }
  }
}

function formatMessage(previous: GuardianSnapshot, current: GuardianSnapshot) {
  const check = current.lastCheck;
  const headline = current.status === "healthy" ? "Nythera AI recovered" : `Nythera AI is ${current.status}`;
  return [
    headline,
    `Status: ${previous.status} -> ${current.status}`,
    check?.provider ? `Provider: ${check.provider}` : null,
    check?.model ? `Model: ${check.model}` : null,
    check?.fallbackTriggered ? "Fallback: active" : null,
    check?.reason ? `Reason: ${check.reason}` : null,
    check ? `Latency: ${check.durationMs}ms` : null,
    `Checked: ${current.checkedAt ?? "unknown"}`
  ].filter(Boolean).join("\n");
}

async function assertSuccessfulNotification(response: Response) {
  if (!response.ok) throw new Error(`Notification endpoint returned ${response.status}.`);
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
