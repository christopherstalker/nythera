import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCallbackPath } from "../src/lib/auth-routes";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("callback destinations stay on the current origin", () => {
  assert.equal(normalizeCallbackPath("/chat/abc?from=login"), "/chat/abc?from=login");
  assert.equal(normalizeCallbackPath("//attacker.example"), "/explore");
  assert.equal(normalizeCallbackPath("/\\attacker.example"), "/explore");
  assert.equal(normalizeCallbackPath("https://attacker.example"), "/explore");
});

test("shared abuse controls bound request, token, image, and response work", async () => {
  const [api, limits, validation, voice, imageConfig] = await Promise.all([
    read("../src/lib/api.ts"),
    read("../src/lib/rate-limit.ts"),
    read("../src/lib/validation.ts"),
    read("../src/app/api/voice/synthesize/route.ts"),
    read("../next.config.mjs")
  ]);

  assert.match(api, /256 \* 1024/);
  assert.match(api, /Request body is too large/);
  assert.match(limits, /chat:token-budget/);
  assert.match(limits, /shares:read/);
  assert.match(limits, /characters:report/);
  assert.match(validation, /max\(4096\)/);
  assert.match(validation, /MAX_IMAGE_DATA_URL_BYTES = 140_000/);
  assert.match(voice, /AbortSignal\.timeout\(20_000\)/);
  assert.match(voice, /8 \* 1024 \* 1024/);
  assert.doesNotMatch(imageConfig, /hostname:\s*"\*\*"/);
});

test("provider URLs are checked before outbound SDK or voice requests", async () => {
  const [policy, gateway, voice] = await Promise.all([
    read("../src/lib/safe-outbound-url.ts"),
    read("../src/lib/llm-gateway.ts"),
    read("../src/app/api/voice/synthesize/route.ts")
  ]);

  assert.match(policy, /url\.protocol !== "https:"/);
  assert.match(policy, /isPrivateAddress/);
  assert.match(policy, /metadata\.google\.internal/);
  assert.match(gateway, /await assertSafeOutboundUrl/);
  assert.match(voice, /redirect: "error"/);
});
