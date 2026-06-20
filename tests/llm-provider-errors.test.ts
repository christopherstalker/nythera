import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("provider failures are exposed instead of becoming a local proxy response", async () => {
  const gatewaySource = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxySource = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  assert.doesNotMatch(gatewaySource, /Local proxy fallback is active/);
  assert.doesNotMatch(gatewaySource, /fallbackStream\(/);
  assert.doesNotMatch(proxySource, /Local proxy fallback is active/);
  assert.doesNotMatch(proxySource, /streamLocal\(/);
});

test("provider errors have safe actionable classifications", async () => {
  const providerErrors = await import("../src/lib/llm-provider-errors").catch(() => null);
  const proxyProviderErrors = await import("../proxy-service/src/provider-errors").catch(() => null);
  assert.equal(typeof providerErrors?.classifyProviderError, "function");
  assert.equal(typeof proxyProviderErrors?.classifyProviderError, "function");

  const invalidKey = providerErrors!.classifyProviderError({ status: 401 });
  assert.deepEqual(invalidKey, {
    code: "invalid_api_key",
    message: "The selected provider rejected the API key. Check the key in Settings.",
    status: 401,
    retryable: false
  });

  const rateLimit = providerErrors!.classifyProviderError({ status: 429 });
  assert.equal(rateLimit.code, "rate_limit");
  assert.match(rateLimit.message, /rate limit/i);
  assert.equal(rateLimit.retryable, false);

  const outage = providerErrors!.classifyProviderError({ status: 503 });
  assert.equal(outage.code, "provider_unavailable");
  assert.equal(outage.retryable, true);

  assert.deepEqual(proxyProviderErrors!.classifyProviderError({ status: 401 }), invalidKey);
});

test("chat SSE preserves the safe provider error for the client", async () => {
  const streamRoute = await readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8");
  assert.match(streamRoute, /publicErrorMessage = chunk\.message/);
  assert.match(streamRoute, /send\(\{ type: "error", message: publicErrorMessage \}\)/);
});
