import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openAIResponseOptions, geminiResponseOptions } from "../proxy-service/src/response-tokens";

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
    assert.match(source, /maxTokens:\s*maxOutputTokens/);
  }
});

test("both gateways map sampler settings to each provider's supported request fields", async () => {
  const builtIn = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  for (const source of [builtIn, proxy]) {
    assert.match(source, /top_p:\s*input\.topP/);
    assert.match(source, /openAIResponseOptions\(input\)/);
    assert.match(source, /max_tokens:\s*input\.maxTokens/);
    assert.match(source, /topP:\s*input\.topP/);
    assert.match(source, /geminiResponseOptions\(input\.model, input\.maxTokens\)/);
  }
  assert.deepEqual(
    openAIResponseOptions({
      providerName: "openai",
      model: "gpt-4o",
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.2,
      maxTokens: 500
    }),
    {
      temperature: 0.8,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      max_tokens: 500
    }
  );
  assert.deepEqual(geminiResponseOptions("gemini-2.0-flash", 500), { maxOutputTokens: 500 });
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
