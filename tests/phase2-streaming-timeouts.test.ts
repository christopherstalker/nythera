import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web and mobile chat message routes stream SSE responses", async () => {
  for (const path of [
    "../src/app/api/chats/[id]/stream/route.ts",
    "../src/app/api/mobile/chats/[id]/message/route.ts"
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /new ReadableStream/);
    assert.match(source, /text\/event-stream/);
    assert.match(source, /x-accel-buffering/);
    assert.match(source, /streamLlmResponse/);
    assert.match(source, /signal:\s*request\.signal/);
  }
});

test("provider calls use explicit timeout and abort signals", async () => {
  const timeoutSource = await readFile(new URL("../src/lib/llm-timeouts.ts", import.meta.url), "utf8");
  const gateway = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../src/lib/proxy.ts", import.meta.url), "utf8");
  const chatHook = await readFile(new URL("../src/hooks/useChat.ts", import.meta.url), "utf8");
  const proxyRoute = await readFile(new URL("../src/app/api/proxy/llm/route.ts", import.meta.url), "utf8");
  const standaloneProxy = await readFile(new URL("../proxy-service/src/server.ts", import.meta.url), "utf8");

  assert.match(timeoutSource, /LLM_PROVIDER_TIMEOUT_MS\s*=\s*40_000/);
  assert.match(timeoutSource, /LLM_FIRST_TOKEN_TIMEOUT_MS\s*=\s*12_000/);
  assert.match(timeoutSource, /LLM_STREAM_IDLE_TIMEOUT_MS\s*=\s*20_000/);
  assert.match(timeoutSource, /LLM_EMBEDDING_TIMEOUT_MS\s*=\s*15_000/);
  assert.match(gateway, /createActivityTimeoutSignal\([\s\S]*LLM_FIRST_TOKEN_TIMEOUT_MS/);
  assert.match(gateway, /attemptSignal\.reset\(LLM_STREAM_IDLE_TIMEOUT_MS/);
  assert.match(gateway, /gatewayDeadline\.signal/);
  assert.match(gateway, /chat\.completions\.create\([\s\S]*\{\s*signal:\s*input\.signal\s*\}/);
  assert.match(gateway, /messages\.stream\([\s\S]*\{\s*signal:\s*input\.signal\s*\}/);
  assert.match(gateway, /timeout:\s*LLM_PROVIDER_TIMEOUT_MS/);
  assert.match(proxy, /createActivityTimeoutSignal\([\s\S]*LLM_FIRST_TOKEN_TIMEOUT_MS/);
  assert.match(proxy, /proxySignal\.reset\(LLM_STREAM_IDLE_TIMEOUT_MS/);
  assert.match(chatHook, /CHAT_STREAM_INACTIVITY_TIMEOUT_MS\s*=\s*55_000/);
  assert.match(chatHook, /streamTimedOut\s*=\s*true;[\s\S]*abortController\.abort\(\)/);
  assert.match(proxyRoute, /signal:\s*request\.signal/);
  assert.match(standaloneProxy, /LLM_PROVIDER_TIMEOUT_MS\s*=\s*40_000/);
  assert.match(standaloneProxy, /LLM_FIRST_TOKEN_TIMEOUT_MS\s*=\s*12_000/);
  assert.match(standaloneProxy, /LLM_STREAM_IDLE_TIMEOUT_MS\s*=\s*20_000/);
  assert.match(standaloneProxy, /LLM_EMBEDDING_TIMEOUT_MS\s*=\s*15_000/);
  assert.match(standaloneProxy, /createActivityTimeoutSignal\([\s\S]*clientAbort\.signal,[\s\S]*LLM_FIRST_TOKEN_TIMEOUT_MS/);
  assert.match(standaloneProxy, /attemptSignal\.reset\(LLM_STREAM_IDLE_TIMEOUT_MS/);
});
