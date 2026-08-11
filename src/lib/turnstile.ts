import "server-only";

import { env } from "@/lib/env";
import { HttpError } from "@/lib/api";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export async function verifyTurnstile(input: {
  token?: string;
  action: string;
  remoteIp?: string;
}) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    if (process.env.NODE_ENV !== "production" || isLocalApplicationOrigin()) {
      return;
    }
    throw new HttpError(503, "Human verification is not configured.");
  }

  const token = input.token?.trim();
  if (!token || token.length > 2048) {
    throw new HttpError(400, "Complete the human verification challenge.");
  }

  const body = new URLSearchParams({ secret, response: token });
  if (input.remoteIp && input.remoteIp !== "127.0.0.1") {
    body.set("remoteip", input.remoteIp);
  }

  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    throw new HttpError(503, "Human verification is temporarily unavailable.");
  }

  const verification = (await response.json()) as TurnstileResponse;
  if (!verification.success || verification.action !== input.action) {
    throw new HttpError(400, "Human verification failed. Refresh the challenge and try again.");
  }

  const allowedHostnames = (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "nythera.art,www.nythera.art")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (verification.hostname && !allowedHostnames.includes(verification.hostname.toLowerCase())) {
    throw new HttpError(400, "Human verification was issued for a different site.");
  }
}

function isLocalApplicationOrigin() {
  const configuredOrigin = env.AUTH_URL || env.NEXTAUTH_URL;
  if (!configuredOrigin) return false;

  try {
    const hostname = new URL(configuredOrigin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}
