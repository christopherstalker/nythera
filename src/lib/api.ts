import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RateLimitError } from "@/lib/rate-limit";

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
      username: true,
      role: true,
      ageVerified: true,
      birthDate: true,
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
  if (error instanceof HttpError || error instanceof RateLimitError) {
    return json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return json({ error: "Invalid request body.", issues: error.flatten() }, { status: 400 });
  }

  console.error(error);
  return json({ error: "Unexpected server error." }, { status: 500 });
}

export async function parseJson<T>(request: Request, schema: { parse: (value: unknown) => T }) {
  const body = await request.json().catch(() => null);
  return schema.parse(body);
}
