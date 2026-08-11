import { createServer } from "node:http";

const port = Number(process.env.FAILOVER_PROVIDER_PORT ?? 43123);
const failingKey = process.env.FAILOVER_PROVIDER_FAILING_KEY ?? "nythera-proof-rate-limited";
const workingKey = process.env.FAILOVER_PROVIDER_WORKING_KEY ?? "nythera-proof-working";

const server = createServer((request, response) => {
  const authorization = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const keySlot = authorization === failingKey ? 1 : authorization === workingKey ? 2 : 0;

  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/v1/models" && request.method === "GET") {
    if (keySlot === 0) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Unknown test credential." } }));
      return;
    }
    process.stdout.write(`${JSON.stringify({ event: "models", keySlot })}\n`);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "failover-model", object: "model" }] }));
    return;
  }

  if (request.url === "/v1/chat/completions" && request.method === "POST") {
    process.stdout.write(`${JSON.stringify({ event: "chat_attempt", keySlot })}\n`);
    if (keySlot === 1) {
      response.writeHead(429, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Simulated first-key rate limit.", type: "rate_limit_error" } }));
      return;
    }
    if (keySlot !== 2) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Unknown test credential." } }));
      return;
    }

    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    response.write(`data: ${JSON.stringify({
      id: "chatcmpl-failover-proof",
      object: "chat.completion.chunk",
      created: 1,
      model: "failover-model",
      choices: [{ index: 0, delta: { content: "Failover verified: the second key answered this chat turn." }, finish_reason: null }]
    })}\n\n`);
    response.write(`data: ${JSON.stringify({
      id: "chatcmpl-failover-proof",
      object: "chat.completion.chunk",
      created: 1,
      model: "failover-model",
      choices: [],
      usage: { prompt_tokens: 12, completion_tokens: 11, total_tokens: 23 }
    })}\n\n`);
    response.end("data: [DONE]\n\n");
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { message: "Not found." } }));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`${JSON.stringify({ event: "ready", port })}\n`);
});
