import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("auth entrypoints enforce rate limits before credential work", async () => {
  const nextAuthRoute = await readFile(new URL("../src/app/api/auth/[...nextauth]/route.ts", import.meta.url), "utf8");
  const webRegisterRoute = await readFile(new URL("../src/app/api/auth/register/route.ts", import.meta.url), "utf8");
  const mobileLoginRoute = await readFile(new URL("../src/app/api/mobile/auth/login/route.ts", import.meta.url), "utf8");
  const mobileRegisterRoute = await readFile(new URL("../src/app/api/mobile/auth/register/route.ts", import.meta.url), "utf8");

  for (const route of [nextAuthRoute, webRegisterRoute, mobileLoginRoute, mobileRegisterRoute]) {
    assert.match(route, /enforceRateLimit/);
    assert.match(route, /getRequestIp/);
  }

  assert.match(nextAuthRoute, /route:\s*"auth:nextauth"/);
  assert.match(webRegisterRoute, /route:\s*"auth:register"/);
  assert.match(mobileLoginRoute, /route:\s*"mobile-auth:login"/);
  assert.match(mobileRegisterRoute, /route:\s*"mobile-auth:register"/);
});

test("production rate limiting requires a distributed store", async () => {
  const redisSource = await readFile(new URL("../src/lib/redis.ts", import.meta.url), "utf8");
  const rateLimitSource = await readFile(new URL("../src/lib/rate-limit.ts", import.meta.url), "utf8");

  assert.match(redisSource, /hasDistributedRateLimitStore/);
  assert.match(rateLimitSource, /NODE_ENV === "production"/);
  assert.match(rateLimitSource, /hasDistributedRateLimitStore\(\)/);
  assert.match(rateLimitSource, /503/);
});
