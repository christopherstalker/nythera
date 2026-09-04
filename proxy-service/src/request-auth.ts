import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const SIGNATURE_WINDOW_MS = 60_000;

export function signShieldRequest(secret: string, path: string, body: string, timestamp = Date.now(), nonce = randomUUID()) {
  const time = String(timestamp);
  return {
    "x-shield-timestamp": time,
    "x-shield-nonce": nonce,
    "x-shield-signature": signature(secret, path, body, time, nonce)
  };
}

export function verifyShieldRequest(secret: string, path: string, body: string, headers: {
  timestamp?: string;
  nonce?: string;
  signature?: string;
}, now = Date.now()) {
  const { timestamp, nonce, signature: provided } = headers;
  if (!timestamp || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) >= SIGNATURE_WINDOW_MS) return false;
  if (!nonce || !/^[a-zA-Z0-9-]{16,80}$/.test(nonce) || !provided || !/^[a-f0-9]{64}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(signature(secret, path, body, timestamp, nonce), "hex"));
}

export class ReplayGuard {
  private readonly nonces = new Map<string, number>();

  consume(nonce: string, now = Date.now()) {
    for (const [key, expiry] of this.nonces) {
      if (expiry <= now) this.nonces.delete(key);
    }
    if (this.nonces.has(nonce) || this.nonces.size >= 20_000) return false;
    this.nonces.set(nonce, now + SIGNATURE_WINDOW_MS * 2);
    return true;
  }
}

function signature(secret: string, path: string, body: string, timestamp: string, nonce: string) {
  const digest = createHash("sha256").update(body).digest("hex");
  return createHmac("sha256", secret).update(`POST\n${path}\n${timestamp}\n${nonce}\n${digest}`).digest("hex");
}
