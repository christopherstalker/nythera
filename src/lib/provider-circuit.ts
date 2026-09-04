import "server-only";

import { createHash } from "crypto";
import { redis } from "@/lib/redis";
import type { ProviderErrorCode } from "@/lib/llm-provider-errors";

type CircuitIdentity = {
  provider: string;
  keyId?: string;
  keySlot?: number;
};

type MemoryCircuit = {
  failures: number;
  failureWindowEndsAt: number;
  openUntil: number;
};

const FAILURE_WINDOW_SECONDS = 120;
const FAILURE_THRESHOLD = 3;
const memoryCircuits = new Map<string, MemoryCircuit>();

export async function isProviderCircuitOpen(identity: CircuitIdentity) {
  return (await readProviderCircuitStates([identity]))[0] ?? false;
}

export async function readProviderCircuitStates(identities: CircuitIdentity[]) {
  if (identities.length === 0) return [];
  const circuitKeys = identities.map(keyFor);

  if (redis) {
    try {
      const openUntilValues = await redis.mget<(number | string | null)[]>(
        ...circuitKeys.map((circuitKey) => openKey(circuitKey))
      );
      const now = Date.now();
      return openUntilValues.map((openUntil) => Number(openUntil ?? 0) > now);
    } catch (error) {
      logCircuitStoreFailure("read", error);
    }
  }

  return circuitKeys.map(isMemoryCircuitOpen);
}

function isMemoryCircuitOpen(circuitKey: string) {
  const state = memoryCircuits.get(circuitKey);
  if (!state || state.openUntil <= Date.now()) {
    return false;
  }
  return true;
}

export async function recordProviderSuccess(identity: CircuitIdentity) {
  const circuitKey = keyFor(identity);
  memoryCircuits.delete(circuitKey);

  if (!redis) return;

  try {
    await redis.del(openKey(circuitKey), failuresKey(circuitKey));
  } catch (error) {
    logCircuitStoreFailure("clear", error);
  }
}

export async function recordProviderFailure(identity: CircuitIdentity, code: ProviderErrorCode) {
  const policy = failurePolicy(code);
  if (!policy) return;

  const circuitKey = keyFor(identity);
  const now = Date.now();

  if (redis) {
    try {
      if (policy.openImmediately) {
        await openDistributedCircuit(circuitKey, now + policy.cooldownSeconds * 1000, policy.cooldownSeconds);
        return;
      }

      const counterKey = failuresKey(circuitKey);
      const failures = await redis.incr(counterKey);
      if (failures === 1) {
        await redis.expire(counterKey, FAILURE_WINDOW_SECONDS);
      }
      if (failures >= FAILURE_THRESHOLD) {
        await openDistributedCircuit(circuitKey, now + policy.cooldownSeconds * 1000, policy.cooldownSeconds);
      }
      return;
    } catch (error) {
      logCircuitStoreFailure("write", error);
    }
  }

  const current = memoryCircuits.get(circuitKey);
  const failures = !current || current.failureWindowEndsAt <= now ? 1 : current.failures + 1;
  const openUntil = policy.openImmediately || failures >= FAILURE_THRESHOLD
    ? now + policy.cooldownSeconds * 1000
    : current?.openUntil ?? 0;
  memoryCircuits.set(circuitKey, {
    failures,
    failureWindowEndsAt: now + FAILURE_WINDOW_SECONDS * 1000,
    openUntil
  });
}

function failurePolicy(code: ProviderErrorCode) {
  if (code === "invalid_api_key" || code === "insufficient_balance") {
    return { cooldownSeconds: 15 * 60, openImmediately: true };
  }
  if (code === "rate_limit") {
    return { cooldownSeconds: 5 * 60, openImmediately: false };
  }
  if (code === "provider_unavailable" || code === "network_error" || code === "provider_error") {
    return { cooldownSeconds: 60, openImmediately: false };
  }
  return null;
}

async function openDistributedCircuit(circuitKey: string, openUntil: number, cooldownSeconds: number) {
  if (!redis) return;
  await redis.set(openKey(circuitKey), openUntil, { ex: cooldownSeconds });
  await redis.del(failuresKey(circuitKey));
}

function keyFor(identity: CircuitIdentity) {
  const raw = `${identity.provider.trim().toLowerCase()}:${identity.keyId ?? `slot-${identity.keySlot ?? 0}`}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function openKey(circuitKey: string) {
  return `guardian:circuit:v1:${circuitKey}:open`;
}

function failuresKey(circuitKey: string) {
  return `guardian:circuit:v1:${circuitKey}:failures`;
}

function logCircuitStoreFailure(operation: string, error: unknown) {
  console.warn(JSON.stringify({
    level: "warn",
    event: "guardian_circuit_store_error",
    operation,
    error: error instanceof Error ? error.message : String(error)
  }));
}
