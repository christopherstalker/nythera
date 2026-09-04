import assert from "node:assert/strict";
import test from "node:test";

import { classifyProviderError as classifyBuiltInError } from "../src/lib/llm-provider-errors";
import { classifyProviderError as classifyProxyError } from "../proxy-service/src/provider-errors";

for (const [name, classify] of [
  ["built-in gateway", classifyBuiltInError],
  ["proxy service", classifyProxyError]
] as const) {
  test(`${name} retries rate limits`, () => {
    assert.deepEqual(classify({ status: 429, message: "Too many requests" }), {
      code: "rate_limit",
      message: "The selected provider's rate limit was reached. Wait a moment and try again.",
      status: 429,
      retryable: true
    });
  });

  test(`${name} does not retry invalid credentials`, () => {
    assert.equal(classify({ status: 401, message: "Unauthorized" }).retryable, false);
  });

  test(`${name} retries provider outages`, () => {
    assert.equal(classify({ status: 503, message: "Unavailable" }).retryable, true);
  });

  test(`${name} retries outage messages when an upstream omits the status code`, () => {
    const classified = classify(new Error("The upstream provider is temporarily unavailable. Try again later."));

    assert.equal(classified.code, "provider_unavailable");
    assert.equal(classified.retryable, true);
  });
}
