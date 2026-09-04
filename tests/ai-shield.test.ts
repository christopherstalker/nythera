import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { signShieldRequest, verifyShieldRequest, ReplayGuard } from "../proxy-service/src/request-auth";
import { CircuitStore, circuitIdentity } from "../proxy-service/src/circuit-store";
import { readProxyStream } from "../src/lib/proxy-stream";

test("Shield signatures bind the path, exact payload, timestamp and nonce", () => {
  const secret = randomBytes(32).toString("hex");
  const now = Date.now();
  const body = JSON.stringify({ message: "hello" });
  const signed = signShieldRequest(secret, "/v1/chat/stream", body, now);
  const headers = { timestamp: signed["x-shield-timestamp"], nonce: signed["x-shield-nonce"], signature: signed["x-shield-signature"] };
  assert.ok(verifyShieldRequest(secret, "/v1/chat/stream", body, headers, now));
  assert.equal(verifyShieldRequest(secret, "/v1/embeddings", body, headers, now), false);
  assert.equal(verifyShieldRequest(secret, "/v1/chat/stream", body + " ", headers, now), false);
  assert.equal(verifyShieldRequest(secret, "/v1/chat/stream", body, headers, now + 60_001), false);
  assert.equal(verifyShieldRequest(secret, "/v1/chat/stream", body, { ...headers, signature: "wrong" }, now), false);
});

test("a signed nonce cannot be replayed while its signature is valid", () => {
  const guard = new ReplayGuard();
  assert.equal(guard.consume("nonce", 0), true);
  assert.equal(guard.consume("nonce", 60_001), false);
  assert.equal(guard.consume("nonce", 120_001), true);
});

test("transient failures open a shared circuit after three failures and expire", async () => {
  const store = new CircuitStore();
  await store.failure("one", "provider_unavailable", 0);
  await store.failure("one", "provider_unavailable", 1);
  assert.equal(await store.isOpen("one", 2), false);
  await store.failure("one", "provider_unavailable", 2);
  assert.equal(await store.isOpen("one", 3), true);
  assert.equal(await store.isOpen("one", 60_003), false);
});

test("credential failures open immediately, success resets state, credentials remain isolated", async () => {
  const store = new CircuitStore();
  const first = circuitIdentity("provider", "model", "first-test-credential");
  const second = circuitIdentity("provider", "model", "second-test-credential");
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /credential/);
  await store.failure(first, "invalid_api_key", 0);
  assert.equal(await store.isOpen(first, 1), true);
  assert.equal(await store.isOpen(second, 1), false);
  await store.success(first);
  assert.equal(await store.isOpen(first, 1), false);
});

test("bad request parameters do not quarantine a healthy provider", async () => {
  const store = new CircuitStore();
  for (let index = 0; index < 4; index++) await store.failure("one", "invalid_parameters", index);
  assert.equal(await store.isOpen("one", 5), false);
});

test("valid SSE delivers text and explicit completion across split packets", async () => {
  const stream = textStream(['data: {"type":"delta","text":"hel', 'lo"}\r\n\r\ndata: {"type":"done"}\r\n\r\n']);
  const received = [];
  for await (const event of readProxyStream(stream, () => undefined)) received.push(event);
  assert.deepEqual(received, [{ type: "delta", text: "hello" }, { type: "done" }]);
});

for (const [name, packets] of [
  ["empty response", ['data: {"type":"done"}\n\n']],
  ["whitespace-only response", ['data: {"type":"delta","text":"   "}\n\ndata: {"type":"done"}\n\n']],
  ["truncated response", ['data: {"type":"delta","text":"hello"}\n\n']],
  ["malformed response", ['data: {"type":"delta","text":123}\n\n']],
  ["provider error", ['data: {"type":"error","message":"upstream failure"}\n\n']]
] as const) {
  test(`Shield rejects ${name} instead of synthesizing success`, async () => {
    await assert.rejects(async () => {
      for await (const _event of readProxyStream(textStream([...packets]), () => undefined)) { /* Drain the stream to its terminal state. */ }
    });
  });
}

function textStream(packets: string[]) {
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (const packet of packets) controller.enqueue(new TextEncoder().encode(packet));
    controller.close();
  } });
}
