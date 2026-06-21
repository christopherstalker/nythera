import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";

test("custom providers use the direct OpenAI-compatible chat-completions endpoint", async (context) => {
  let requestedPath = "";
  let authorization = "";
  const upstream = createServer((request, response) => {
    requestedPath = request.url ?? "";
    authorization = request.headers.authorization ?? "";
    writeSuccessfulOpenAIStream(response, "direct response");
  });
  const upstreamUrl = await listen(upstream);
  const proxy = await startProxy();

  context.after(async () => {
    await Promise.allSettled([stopProcess(proxy), closeServer(upstream)]);
  });

  const body = await requestProxy(proxy.port, [providerKey("local-vllm", upstreamUrl, 0)]);
  assert.match(body, /direct response/);
  assert.equal(requestedPath, "/chat/completions");
  assert.equal(authorization, "Bearer local-test-key");
  assert.doesNotMatch(body, /openrouter/i);
});

test("a retryable 429 advances to the next enabled provider", async (context) => {
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  const primary = createServer((_request, response) => {
    primaryAttempts += 1;
    response.writeHead(429, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Rate limit reached", type: "rate_limit_error" } }));
  });
  const fallback = createServer((_request, response) => {
    fallbackAttempts += 1;
    writeSuccessfulOpenAIStream(response, "fallback response");
  });
  const [primaryUrl, fallbackUrl] = await Promise.all([listen(primary), listen(fallback)]);
  const proxy = await startProxy();

  context.after(async () => {
    await Promise.allSettled([stopProcess(proxy), closeServer(primary), closeServer(fallback)]);
  });

  const body = await requestProxy(proxy.port, [
    providerKey("primary-local", primaryUrl, 0),
    providerKey("fallback-local", fallbackUrl, 1)
  ]);

  assert.ok(primaryAttempts >= 1);
  assert.equal(fallbackAttempts, 1);
  assert.match(body, /fallback response/);
  assert.match(body, /"fallbackTriggered":true/);
  assert.match(body, /"provider":"fallback-local"/);
});

function providerKey(provider: string, baseUrl: string, fallbackPriority: number) {
  return {
    provider,
    displayName: provider,
    apiFormat: "OPENAI_COMPATIBLE",
    apiKey: "local-test-key",
    baseUrl,
    defaultModel: "local-model",
    fallbackEnabled: true,
    fallbackPriority
  };
}

async function requestProxy(port: number, providerKeys: ReturnType<typeof providerKey>[]) {
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat/stream`, {
    method: "POST",
    headers: {
      authorization: "Bearer integration-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Say hello." }],
      model: `${providerKeys[0].provider}:local-model`,
      temperature: 0.7,
      providerKeys
    })
  });
  assert.equal(response.status, 200);
  return response.text();
}

async function startProxy() {
  const port = await reservePort();
  const child = spawn(process.execPath, ["--import", "tsx", path.join(process.cwd(), "proxy-service/src/server.ts")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      INTERNAL_API_TOKEN: "integration-token",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      LOG_LEVEL: "silent"
    },
    stdio: "ignore"
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Proxy exited before becoming ready with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return Object.assign(child, { port });
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  child.kill();
  throw new Error("Proxy did not become ready.");
}

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine mock server port.");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function reservePort() {
  const server = createServer();
  const url = await listen(server);
  const port = Number(new URL(url).port);
  await closeServer(server);
  return port;
}

async function stopProcess(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = once(child, "exit");
  child.kill();
  await exited;
}

async function closeServer(server: Server) {
  if (!server.listening) {
    return;
  }
  const closed = once(server, "close");
  server.close();
  await closed;
}

function writeSuccessfulOpenAIStream(response: import("node:http").ServerResponse, text: string) {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write(`data: ${JSON.stringify({
    id: "chatcmpl-local",
    object: "chat.completion.chunk",
    created: 1,
    model: "local-model",
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
  })}\n\n`);
  response.write(`data: ${JSON.stringify({
    id: "chatcmpl-local",
    object: "chat.completion.chunk",
    created: 1,
    model: "local-model",
    choices: [],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
  })}\n\n`);
  response.end("data: [DONE]\n\n");
}
