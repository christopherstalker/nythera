import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop and mobile chat routes resolve and forward character sampler settings", async () => {
  for (const path of [
    "../src/app/api/chats/[id]/stream/route.ts",
    "../src/app/api/mobile/chats/[id]/message/route.ts"
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /resolveCharacterModelSettings/);
    assert.match(source, /topP:\s*effectiveSettings\.topP/);
    assert.match(source, /frequencyPenalty:\s*effectiveSettings\.frequencyPenalty/);
    assert.match(source, /presencePenalty:\s*effectiveSettings\.presencePenalty/);
    assert.match(source, /maxTokens:\s*providerMaxOutputTokens/);
  }
});

test("both gateways map sampler settings to each provider's supported request fields", async () => {
  const builtIn = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  for (const source of [builtIn, proxy]) {
    assert.match(source, /top_p:\s*input\.topP/);
    assert.match(source, /frequency_penalty:\s*input\.providerName === "deepseek" \? undefined : input\.frequencyPenalty/);
    assert.match(source, /presence_penalty:\s*input\.providerName === "deepseek" \? undefined : input\.presencePenalty/);
    assert.match(source, /max_tokens:\s*input\.maxTokens/);
    assert.match(source, /topP:\s*input\.topP/);
    assert.match(source, /maxOutputTokens:\s*input\.maxTokens/);
  }
});

test("the standalone custom-provider path always uses OpenAI-compatible chat completions", async () => {
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");
  assert.match(proxy, /client\.chat\.completions\.create/);
  assert.doesNotMatch(proxy, /responses\?\.stream|responses\.stream/);
});

test("Anthropic receives every assembled system layer in both gateways", async () => {
  const builtIn = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  for (const source of [builtIn, proxy]) {
    assert.match(source, /filter\(\(message\) => message\.role === "system"\)/);
    assert.match(source, /map\(\(message\) => message\.content\)/);
    assert.match(source, /join\("\\n\\n"\)/);
  }
});
