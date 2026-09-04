import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { loadGuardianConfig } from "../guardian-service/src/config";
import { advanceSnapshot } from "../guardian-service/src/monitor";
import { EMPTY_SNAPSHOT, type CanaryCheck } from "../guardian-service/src/types";

const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  GUARDIAN_TARGET_URL: "https://www.nythera.art",
  GUARDIAN_SHARED_SECRET: "shared-secret-with-at-least-32-characters",
  GUARDIAN_API_TOKEN: "guardian-api-token-with-at-least-32-characters"
};

test("guardian configuration requires paired durable-store credentials", () => {
  assert.throws(() => loadGuardianConfig({
    ...baseEnvironment,
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io"
  }), /Both Upstash Redis variables/);

  const config = loadGuardianConfig(baseEnvironment);
  assert.equal(config.GUARDIAN_INTERVAL_MS, 120_000);
  assert.equal(config.GUARDIAN_TIMEOUT_MS, 45_000);
});

test("guardian opens an incident only after two consecutive hard failures", () => {
  const firstFailure = advanceSnapshot(EMPTY_SNAPSHOT, check("down", "2026-09-04T00:00:00.000Z"));
  assert.equal(firstFailure.status, "degraded");
  assert.equal(firstFailure.consecutiveFailures, 1);

  const secondFailure = advanceSnapshot(firstFailure, check("down", "2026-09-04T00:02:00.000Z"));
  assert.equal(secondFailure.status, "down");
  assert.equal(secondFailure.consecutiveFailures, 2);
});

test("guardian reports fallback as degraded and clears the incident on recovery", () => {
  const degraded = advanceSnapshot(EMPTY_SNAPSHOT, {
    ...check("degraded", "2026-09-04T00:00:00.000Z"),
    fallbackTriggered: true,
    provider: "gemini"
  });
  assert.equal(degraded.status, "degraded");

  const recovered = advanceSnapshot(degraded, check("healthy", "2026-09-04T00:02:00.000Z"));
  assert.equal(recovered.status, "healthy");
  assert.equal(recovered.consecutiveFailures, 0);
  assert.equal(recovered.changedAt, "2026-09-04T00:02:00.000Z");
});

test("application gateway and canary are connected to the distributed circuit breaker", async () => {
  const [gateway, circuit, canary] = await Promise.all([
    readFile("src/lib/llm-gateway.ts", "utf8"),
    readFile("src/lib/provider-circuit.ts", "utf8"),
    readFile("src/app/api/internal/guardian/canary/route.ts", "utf8")
  ]);

  assert.match(gateway, /readProviderCircuitStates/);
  assert.match(gateway, /recordProviderFailure/);
  assert.match(gateway, /recordProviderSuccess/);
  assert.match(circuit, /guardian:circuit:v1/);
  assert.match(circuit, /FAILURE_THRESHOLD = 3/);
  assert.match(canary, /GUARDIAN_SHARED_SECRET/);
  assert.match(canary, /streamGatewayResponse/);
});

function check(status: CanaryCheck["status"], checkedAt: string): CanaryCheck {
  return {
    id: checkedAt,
    status,
    checkedAt,
    durationMs: 100,
    httpStatus: status === "down" ? 503 : 200
  };
}
