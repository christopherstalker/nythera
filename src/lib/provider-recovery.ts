import { createHash } from "node:crypto";
import type { PromptMessage } from "@/types";

export function providerCircuitKey(identity: { provider: string; model: string; credential: string; keyId?: string }) {
  return createHash("sha256")
    .update(JSON.stringify([identity.provider.toLowerCase(), identity.model, identity.keyId ?? "", identity.credential]))
    .digest("hex");
}

export function selectCircuitAttempts<T extends { key?: { source?: "user" | "platform" } }>(attempts: T[], open: boolean[]) {
  const available = attempts.filter((_, index) => !open[index]);
  if (available.length) return available;
  // A user-initiated BYOK request gets one recovery attempt, not a dead end.
  const personal = attempts.find((attempt) => attempt.key?.source === "user");
  return personal ? [personal] : [];
}

export function shortenRetryHistory(messages: PromptMessage[]) {
  const userIndices = messages.flatMap((message, index) => message.role === "user" ? [index] : []);
  if (userIndices.length < 2) return null;
  const keepFrom = userIndices[Math.ceil((userIndices.length - 1) / 2)];
  return messages.filter((message, index) => message.role === "system" || index >= keepFrom);
}
