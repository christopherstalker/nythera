import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { env } from "@/lib/env";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const googleTokenInfoSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional(),
  name: z.string().optional(),
  picture: z.string().url().optional()
});

const mobileTokenPayloadSchema = z.object({
  type: z.literal("mobile"),
  sub: z.string(),
  email: z.string().email(),
  iat: z.number(),
  exp: z.number()
});

export type MobileUser = Awaited<ReturnType<typeof requireMobileUser>>;

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function getMobileSecret() {
  const secret = env.MOBILE_AUTH_SECRET ?? env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing MOBILE_AUTH_SECRET or NEXTAUTH_SECRET.");
  }

  return secret;
}

function sign(input: string) {
  return createHmac("sha256", getMobileSecret()).update(input).digest("base64url");
}

export function createMobileToken(user: { id: string; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    type: "mobile" as const,
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${TOKEN_VERSION}.${encoded}.${sign(`${TOKEN_VERSION}.${encoded}`)}`;
}

export function verifyMobileToken(token: string) {
  const [version, encodedPayload, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !encodedPayload || !signature) {
    throw new HttpError(401, "Invalid mobile session.");
  }

  const expected = sign(`${version}.${encodedPayload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new HttpError(401, "Invalid mobile session.");
  }

  let payload: z.infer<typeof mobileTokenPayloadSchema>;
  try {
    payload = mobileTokenPayloadSchema.parse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
  } catch {
    throw new HttpError(401, "Invalid mobile session.");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Mobile session expired.");
  }

  return payload;
}

export async function requireMobileUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    throw new HttpError(401, "Authentication required.");
  }

  const token = verifyMobileToken(match[1]);
  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      image: true,
      avatarUrl: true,
      bio: true,
      role: true,
      ageVerified: true,
      birthDate: true,
      memoryEnabled: true,
      compactMode: true,
      notificationsEnabled: true,
      preferredTheme: true,
      accentColor: true,
      preferredProvider: true,
      preferredModel: true,
      bannedAt: true
    }
  });

  if (!user || user.bannedAt) {
    throw new HttpError(403, "This account cannot access the platform.");
  }

  return user;
}

export async function verifyGoogleIdToken(idToken: string) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new HttpError(401, "Google sign-in token was rejected.");
  }

  const tokenInfo = googleTokenInfoSchema.parse(await response.json());
  const allowedAudiences = [env.GOOGLE_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID].filter(Boolean);
  if (!allowedAudiences.length) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_ANDROID_CLIENT_ID.");
  }

  if (!allowedAudiences.includes(tokenInfo.aud)) {
    throw new HttpError(401, "Google sign-in token audience is not allowed.");
  }

  if (tokenInfo.iss !== "accounts.google.com" && tokenInfo.iss !== "https://accounts.google.com") {
    throw new HttpError(401, "Google sign-in token issuer is not allowed.");
  }

  if (tokenInfo.email_verified === false || tokenInfo.email_verified === "false") {
    throw new HttpError(401, "Google account email is not verified.");
  }

  return tokenInfo;
}

export async function findOrCreateGoogleMobileUser(google: Awaited<ReturnType<typeof verifyGoogleIdToken>>) {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: google.sub
      }
    },
    include: { user: true }
  });

  if (account?.user) {
    if (account.user.bannedAt) {
      throw new HttpError(403, "This account cannot access the platform.");
    }

    return account.user;
  }

  const email = google.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        emailVerified: new Date(),
        name: google.name,
        image: google.picture
      }
    }));

  if (user.bannedAt) {
    throw new HttpError(403, "This account cannot access the platform.");
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: google.sub
      }
    },
    create: {
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: google.sub
    },
    update: {
      userId: user.id
    }
  });

  return user;
}

export function publicMobileUser(user: {
  id: string;
  email: string;
  username?: string | null;
  name?: string | null;
  image?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  role?: string;
  ageVerified?: boolean;
  memoryEnabled?: boolean;
  compactMode?: boolean;
  notificationsEnabled?: boolean;
  preferredTheme?: string;
  accentColor?: string;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? user.image ?? null,
    bio: user.bio ?? null,
    role: user.role,
    ageVerified: user.ageVerified ?? false,
    memoryEnabled: user.memoryEnabled ?? true,
    compactMode: user.compactMode ?? false,
    notificationsEnabled: user.notificationsEnabled ?? false,
    preferredTheme: user.preferredTheme ?? "dark",
    accentColor: user.accentColor ?? "#8F81F7"
  };
}
