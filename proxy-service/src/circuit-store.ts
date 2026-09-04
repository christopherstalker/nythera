import { createHash } from "node:crypto";
import type { ProviderErrorClassification } from "./provider-errors.js";

type Circuit = { failures: number; expiresAt: number; openUntil: number };
type RedisConfig = { url: string; token: string };

export class CircuitStore {
  private readonly circuits = new Map<string, Circuit>();

  constructor(private readonly redis?: RedisConfig) {}

  distributed() {
    return Boolean(this.redis);
  }

  async consumeNonce(nonce: string) {
    if (!this.redis) return true;
    // Authentication fails closed if replay protection cannot reach its store.
    return await this.command(["SET", `shield:nonce:${nonce}`, "1", "NX", "EX", "120"]) === "OK";
  }

  async isOpen(identity: string, now = Date.now()) {
    if (this.redis) {
      try {
        return Number(await this.command(["GET", `shield:circuit:${identity}:open`])) > now || (this.circuits.get(identity)?.openUntil ?? 0) > now;
      } catch {
        // The local mirror preserves cooldowns during a store outage.
      }
    }
    return (this.circuits.get(identity)?.openUntil ?? 0) > now;
  }

  async success(identity: string) {
    this.circuits.delete(identity);
    if (this.redis) {
      await this.command(["DEL", `shield:circuit:${identity}:open`, `shield:circuit:${identity}:failures`]).catch(() => null);
    }
  }

  async failure(identity: string, code: ProviderErrorClassification["code"], now = Date.now()) {
    const immediate = code === "invalid_api_key" || code === "insufficient_balance";
    if (!immediate && !["rate_limit", "network_error", "provider_error", "provider_unavailable", "model_unavailable"].includes(code)) return;
    const cooldown = immediate ? 900 : code === "rate_limit" ? 300 : 60;
    for (const [key, state] of this.circuits) {
      if (Math.max(state.expiresAt, state.openUntil) <= now) this.circuits.delete(key);
    }
    const previous = this.circuits.get(identity);
    const failures = previous && previous.expiresAt > now ? previous.failures + 1 : 1;
    const openUntil = Math.max(previous?.openUntil ?? 0, immediate || failures >= 3 ? now + cooldown * 1000 : 0);
    this.circuits.set(identity, { failures, expiresAt: previous && previous.expiresAt > now ? previous.expiresAt : now + 120_000, openUntil });
    if (!this.redis) return;
    const script = "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 120) end; if n >= 3 or ARGV[1] == '1' then redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); redis.call('DEL', KEYS[1]) end; return n";
    await this.command(["EVAL", script, "2", `shield:circuit:${identity}:failures`, `shield:circuit:${identity}:open`, immediate ? "1" : "0", String(now + cooldown * 1000), String(cooldown)]).catch(() => null);
  }

  private async command(command: string[]) {
    const response = await fetch(this.redis!.url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.redis!.token}`, "content-type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(800)
    });
    if (!response.ok) throw new Error("Shield store unavailable.");
    const payload = await response.json() as { result?: unknown; error?: string };
    if (payload.error) throw new Error("Shield store rejected command.");
    return payload.result;
  }
}

export function circuitIdentity(provider: string, model: string, credential: string) {
  return createHash("sha256").update(`${provider}\n${model}\n${credential}`).digest("hex");
}
