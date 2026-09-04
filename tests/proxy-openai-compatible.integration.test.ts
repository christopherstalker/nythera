import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { randomBytes } from "node:crypto";
import { signShieldRequest } from "../proxy-service/src/request-auth";

const STARTUP_FAILURE_FIXTURE_ENV = "PROXY_STARTUP_FAILURE_FIXTURE";
const isStartupFailureFixture = process.env[STARTUP_FAILURE_FIXTURE_ENV] === "1";

function integrationTest(name: string, run: (context: TestContext) => void | Promise<void>) {
  if (!isStartupFailureFixture) {
    test(name, run);
  }
}

integrationTest("custom providers use the direct OpenAI-compatible chat-completions endpoint", async (context) => {
  let requestedPath = "";
  let authorization = "";
  const upstream = createServer((request, response) => {
    requestedPath = request.url ?? "";
    authorization = request.headers.authorization ?? "";
    writeSuccessfulOpenAIStream(response, "direct response");
  });
  const upstreamUrl = await listen(upstream);
  const proxy = await startProxyWithCleanup(context, [upstream]);
  const body = await requestProxy(proxy.port, [providerKey("local-vllm", upstreamUrl, 0)]);
  assert.match(body, /direct response/);
  assert.equal(requestedPath, "/chat/completions");
  assert.equal(authorization, "Bearer local-test-key");
  assert.doesNotMatch(body, /openrouter/i);
});

integrationTest("a retryable 429 advances to the next enabled provider", async (context) => {
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
  const proxy = await startProxyWithCleanup(context, [primary, fallback]);
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

integrationTest("a retryable 429 advances to the next key for the same provider", async (context) => {
  const attemptedKeys: string[] = [];
  const upstream = createServer((request, response) => {
    const authorization = request.headers.authorization ?? "";
    attemptedKeys.push(authorization.replace(/^Bearer\s+/i, ""));
    if (authorization === "Bearer rate-limited-key") {
      response.writeHead(429, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Rate limit reached", type: "rate_limit_error" } }));
      return;
    }
    writeSuccessfulOpenAIStream(response, "same-provider failover response");
  });
  const upstreamUrl = await listen(upstream);
  const proxy = await startProxyWithCleanup(context, [upstream]);
  const body = await requestProxy(proxy.port, [
    providerKey("same-provider", upstreamUrl, 0, { id: "key-1", apiKey: "rate-limited-key", providerPriority: 0 }),
    providerKey("same-provider", upstreamUrl, 0, { id: "key-2", apiKey: "working-key", providerPriority: 1 })
  ]);

  assert.deepEqual(attemptedKeys, ["rate-limited-key", "working-key"]);
  assert.match(body, /same-provider failover response/);
  assert.match(body, /"fallbackTriggered":true/);
  assert.match(body, /"attempts":\["same-provider:local-model","same-provider:local-model"\]/);
});

integrationTest("exhausting every key for a provider returns a specific error", async (context) => {
  let attempts = 0;
  const upstream = createServer((_request, response) => {
    attempts += 1;
    response.writeHead(429, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Rate limit reached", type: "rate_limit_error" } }));
  });
  const upstreamUrl = await listen(upstream);
  const proxy = await startProxyWithCleanup(context, [upstream]);
  const body = await requestProxy(proxy.port, [
    providerKey("same-provider", upstreamUrl, 0, { id: "key-1", apiKey: "limited-one", providerPriority: 0 }),
    providerKey("same-provider", upstreamUrl, 0, { id: "key-2", apiKey: "limited-two", providerPriority: 1 })
  ]);

  assert.equal(attempts, 2);
  assert.match(body, /All 2 saved keys for same-provider failed for this request/);
});

integrationTest("proxy readiness allows a slow cold start", async (context) => {
  let child: ChildProcess | undefined;
  context.after(async () => {
    if (child) {
      await stopProcess(child);
    }
  });

  const started = Date.now();
  const proxy = await startProxy({
    nodeArgs: delayedHealthServerArgs(2_500),
    onSpawn(spawned) {
      child = spawned;
    }
  });

  assert.equal(proxy, child);
  assert.ok(Date.now() - started >= 2_500);
});

integrationTest("signed Shield rejects tampering and replay while preserving long system prompts", async (context) => {
  let observedPromptLength = 0;
  const upstream = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const payload = JSON.parse(raw) as { messages: Array<{ content: string }> };
    observedPromptLength = payload.messages[0].content.length;
    writeSuccessfulOpenAIStream(response, "signed response");
  });
  const upstreamUrl = await listen(upstream);
  const secret = randomBytes(32).toString("hex");
  const proxy = await startProxyWithCleanup(context, [upstream], { env: { AI_SHIELD_SIGNING_SECRET: secret } });
  const body = JSON.stringify({
    messages: [{ role: "system", content: "Scene instructions. ".repeat(3_500) }, { role: "user", content: "Say hello." }],
    model: "local-shield:local-model",
    providerKeys: [providerKey("local-shield", upstreamUrl, 0)]
  });
  const path = "/v1/chat/stream";
  const url = `http://127.0.0.1:${proxy.port}${path}`;
  const signed = { "content-type": "application/json", ...signShieldRequest(secret, path, body) };
  const tampered = await fetch(url, { method: "POST", headers: signed, body: body + " " });
  assert.equal(tampered.status, 401);
  await tampered.text();
  const accepted = await fetch(url, { method: "POST", headers: signed, body });
  assert.equal(accepted.status, 200);
  assert.match(await accepted.text(), /signed response/);
  assert.equal(observedPromptLength, 70_000);
  const replay = await fetch(url, { method: "POST", headers: signed, body });
  assert.equal(replay.status, 401);
  await replay.text();
  const unsigned = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer integration-token" }, body });
  assert.equal(unsigned.status, 401);
  await unsigned.text();
});

integrationTest("proxy startup reports signal termination", async (context) => {
  let child: ChildProcess | undefined;
  context.after(async () => {
    if (child) {
      await stopProcess(child);
    }
  });

  await assert.rejects(
    startProxy({
      nodeArgs: ["--eval", "setInterval(() => {}, 1_000)"],
      onSpawn(spawned) {
        child = spawned;
        spawned.kill("SIGTERM");
      }
    }),
    /signal SIGTERM/
  );
  assert.equal(child?.signalCode, "SIGTERM");
});

integrationTest("startup failure cleanup lets the test subprocess exit", async () => {
  const fixture = spawn(
    process.execPath,
    ["--import", "tsx", path.join(process.cwd(), "tests/proxy-openai-compatible.integration.test.ts")],
    {
      cwd: process.cwd(),
      env: { ...process.env, [STARTUP_FAILURE_FIXTURE_ENV]: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let output = "";
  for (const stream of [fixture.stdout, fixture.stderr]) {
    stream?.setEncoding("utf8");
    stream?.on("data", (chunk: string) => {
      output += chunk;
    });
  }

  const result = await waitForProcessExit(fixture, 4_000);
  assert.equal(result.signal, null);
  assert.equal(result.code, 1);
  assert.match(output, /Proxy exited before becoming ready with code 23\./);
});

if (isStartupFailureFixture) {
  test("forced startup failure closes its mock server", async (context) => {
    const upstream = createServer();
    await listen(upstream);
    await startProxyWithCleanup(context, [upstream], { nodeArgs: ["--eval", "process.exit(23)"] });
  });
}

function providerKey(
  provider: string,
  baseUrl: string,
  fallbackPriority: number,
  overrides: Partial<{
    id: string;
    apiKey: string;
    providerPriority: number;
  }> = {}
) {
  return {
    id: overrides.id,
    provider,
    displayName: provider,
    apiFormat: "OPENAI_COMPATIBLE",
    apiKey: overrides.apiKey ?? "local-test-key",
    baseUrl,
    defaultModel: "local-model",
    fallbackEnabled: true,
    fallbackPriority,
    providerPriority: overrides.providerPriority ?? 0
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

type StartProxyOptions = {
  env?: Partial<NodeJS.ProcessEnv>;
  nodeArgs?: string[];
  onSpawn?: (child: ChildProcess) => void;
};

const PROXY_STARTUP_TIMEOUT_MS = 60_000;
const PROXY_READINESS_POLL_MS = 25;

async function startProxyWithCleanup(context: TestContext, servers: Server[], options: StartProxyOptions = {}) {
  let proxy: Awaited<ReturnType<typeof startProxy>> | undefined;
  context.after(async () => {
    const cleanup = servers.map((server) => closeServer(server));
    if (proxy) {
      cleanup.push(stopProcess(proxy));
    }
    await Promise.allSettled(cleanup);
  });

  proxy = await startProxy(options);
  return proxy;
}

async function startProxy(options: StartProxyOptions = {}) {
  const port = await reservePort();
  const nodeArgs = options.nodeArgs ?? ["--import", "tsx", path.join(process.cwd(), "proxy-service/src/server.ts")];
  const child = spawn(process.execPath, nodeArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      INTERNAL_API_TOKEN: "integration-token",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      LOG_LEVEL: "silent",
      ...options.env
    },
    stdio: "ignore"
  });
  options.onSpawn?.(child);

  const deadline = Date.now() + PROXY_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.signalCode !== null) {
      throw new Error(`Proxy exited before becoming ready with signal ${child.signalCode}.`);
    }
    if (child.exitCode !== null) {
      throw new Error(`Proxy exited before becoming ready with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return Object.assign(child, { port });
      }
    } catch {}

    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(PROXY_READINESS_POLL_MS, remainingMs)));
    }
  }

  await stopProcess(child);
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

async function waitForProcessExit(child: ChildProcess, timeoutMs: number) {
  try {
    const [code, signal] = await once(child, "close", { signal: AbortSignal.timeout(timeoutMs) });
    return { code: code as number | null, signal: signal as NodeJS.Signals | null };
  } catch {
    await stopProcess(child);
    throw new Error(`Startup-failure fixture did not exit within ${timeoutMs}ms.`);
  }
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

function delayedHealthServerArgs(delayMs: number) {
  return [
    "--eval",
    `const { createServer } = require("node:http");
setTimeout(() => {
  createServer((request, response) => {
    if (request.url !== "/health") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"ok":true}');
  }).listen(Number(process.env.PORT), "127.0.0.1");
}, ${delayMs});`
  ];
}
