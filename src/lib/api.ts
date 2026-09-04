import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RateLimitError } from "@/lib/rate-limit";
import { isPlatformAdminEmail } from "@/lib/admin";
import { logSafeError } from "@/lib/secret-redaction";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new HttpError(401, "Authentication required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      ageVerified: true,
      birthDate: true,
      adultTermsAcceptedAt: true,
      adultTermsVersion: true,
      memoryEnabled: true,
      compactMode: true,
      notificationsEnabled: true,
      unlimitedCharacterFields: true,
      preferredProvider: true,
      preferredModel: true,
      defaultTemperature: true,
      maxOutputTokens: true,
      defaultResponsePrompt: true,
      preferredChatMode: true,
      bannedAt: true
    }
  });

  if (!user || user.bannedAt) {
    throw new HttpError(403, "This account cannot access the platform.");
  }

  return user;
}

export function requireModerator(role: string) {
  if (role !== "ADMIN" && role !== "MODERATOR") {
    throw new HttpError(403, "Moderator access required.");
  }
}

export function requirePlatformAdmin(user: { email: string }) {
  if (!isPlatformAdminEmail(user.email)) {
    throw new HttpError(403, "Admin access required.");
  }
}

export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function routeError(error: unknown) {
  if (error instanceof RateLimitError) {
    const headers =
      error.status === 429 && error.retryAfterSeconds
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : undefined;
    return json({ error: error.message }, { status: error.status, headers });
  }

  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return json({ error: error.issues[0]?.message ?? "Invalid request body.", issues: error.flatten() }, { status: 400 });
  }

  logSafeError("Unexpected route error.", error);
  return json({ error: "Unexpected server error." }, { status: 500 });
}

export async function parseJson<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
  options: { maxBytes?: number | null } = {}
) {
  const maxBytes = options.maxBytes === undefined ? 256 * 1024 : options.maxBytes;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (maxBytes !== null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, "Request body is too large.");
  }

  const raw = await request.text();
  if (maxBytes !== null && new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, "Request body is too large.");
  }

  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }

  return schema.parse(body);
}
