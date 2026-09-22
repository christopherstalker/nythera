import assert from "node:assert/strict";
import test from "node:test";

import { classifyProviderError as classifyBuiltInError } from "../src/lib/llm-provider-errors";
import { classifyProviderError as classifyProxyError } from "../proxy-service/src/provider-errors";

for (const [name, classify] of [
  ["built-in gateway", classifyBuiltInError],
  ["proxy service", classifyProxyError]
] as const) {
  test(`${name} reports content blocks without treating keys as invalid`, () => {
    for (const error of [
      new Error("[GoogleGenerativeAI Error]: Text not available. Response was blocked due to PROHIBITED_CONTENT"),
      new Error("Text not available. Candidate was blocked due to SAFETY"),
      { status: 403, message: "content_filter" }
    ]) {
      const classified = classify(error);
      assert.equal(classified.code, "content_blocked");
      assert.equal(classified.retryable, false);
      assert.match(classified.message, /content policy/);
      assert.doesNotMatch(classified.message, /Check the key|Refresh its model list/);
      assert.deepEqual(classifyBuiltInError(error), classifyProxyError(error));
    }
  });

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

  test(`${name} distinguishes exhausted credits from transient rate limits`, () => {
    for (const details of [{ code: "credit_balance_exhausted" }, { type: "insufficient_quota" }]) {
      const classified = classify({ status: 429, message: "Request rejected", ...details });
      assert.equal(classified.code, "insufficient_balance");
      assert.equal(classified.retryable, false);
    }
  });

  test(`${name} classifies the gateway deadline separately from connectivity failures`, () => {
    const classified = classify(new Error("Provider request timed out."));
    assert.equal(classified.code, "provider_timeout");
    assert.equal(classified.retryable, true);
  });

  test(`${name} retries outage messages when an upstream omits the status code`, () => {
    const classified = classify(new Error("The upstream provider is temporarily unavailable. Try again later."));

    assert.equal(classified.code, "provider_unavailable");
    assert.equal(classified.retryable, true);
  });
}
