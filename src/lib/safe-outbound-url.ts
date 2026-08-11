import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "@/lib/api";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const resolutionCache = new Map<string, number>();

export async function assertSafeOutboundUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Provider URL is invalid.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowLoopbackTestEndpoint = process.env.NODE_ENV !== "production" &&
    process.env.BYOK_ALLOW_PRIVATE_TEST_ENDPOINTS === "true" &&
    url.protocol === "http:" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1");
  if (allowLoopbackTestEndpoint && !url.username && !url.password) {
    return url.toString().replace(/\/+$/, "");
  }

  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new HttpError(400, "Provider URL must use public HTTPS on port 443.");
  }

  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new HttpError(400, "Private provider hosts are not allowed.");
  }

  if ((resolutionCache.get(hostname) ?? 0) < Date.now()) {
    const addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true }).catch(() => {
          throw new HttpError(400, "Provider host could not be resolved.");
        });

    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new HttpError(400, "Private provider addresses are not allowed.");
    }
    resolutionCache.set(hostname, Date.now() + 5 * 60_000);
  }

  return url.toString().replace(/\/+$/, "");
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    return isPrivateAddress(normalized.slice(7));
  }

  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}
