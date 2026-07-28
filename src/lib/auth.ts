import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Twitter from "next-auth/providers/twitter";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { SecureNodemailer } from "@/lib/auth-email-provider";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { assertCanonicalAuthOrigin } from "@/lib/site-origin";

const MAX_SESSION_IMAGE_URL_LENGTH = 2048;

assertCanonicalAuthOrigin(process.env.VERCEL_ENV, env.AUTH_URL, env.NEXTAUTH_URL);

function safeSessionImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("data:") || value.length > MAX_SESSION_IMAGE_URL_LENGTH) {
    return null;
  }

  return value;
}

async function generateUniqueUsername(seed: string) {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .replace(/^_+|_+$/g, "")
      .slice(0, 18) || "traveler";

  let candidate = base;
  let suffix = 0;

  while (await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 20);
  }

  return candidate;
}

const providers = [
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      })
    : null,
  env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
    ? Discord({
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET
      })
    : null,
  env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET
    ? Twitter({
        clientId: env.TWITTER_CLIENT_ID,
        clientSecret: env.TWITTER_CLIENT_SECRET
      })
    : null,
  env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET
    ? MicrosoftEntraID({
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET
      })
    : null,
  env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
    ? Apple({
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET
      })
    : null,
  env.EMAIL_SERVER && env.EMAIL_FROM
    ? SecureNodemailer({
        server: env.EMAIL_SERVER,
        from: env.EMAIL_FROM
      })
    : null,
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").toLowerCase().trim();
      const password = String(credentials?.password ?? "");

      if (!email || !password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { passwordCredential: true }
      });

      if (!user?.passwordCredential || user.bannedAt) {
        return null;
      }

      const valid = await bcrypt.compare(password, user.passwordCredential.passwordHash);
      if (!valid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? user.username,
        image: safeSessionImageUrl(user.avatarUrl ?? user.image),
        role: user.role,
        username: user.username
      };
    }
  })
].filter(Boolean) as NextAuthConfig["providers"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: "/login",
    newUser: "/settings"
  },
  providers,
  events: {
    async createUser({ user }) {
      if (!user.id) {
        return;
      }

      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { username: true, name: true, email: true }
      });

      if (!existing || existing.username) {
        return;
      }

      const seed = existing.name?.trim() || existing.email?.split("@")[0] || `traveler_${user.id.slice(-6)}`;
      const username = await generateUniqueUsername(seed);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          username,
          name: existing.name ?? username
        }
      });
    }
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            avatarUrl: true,
            image: true
          }
        });

        if (dbUser) {
          token.email = dbUser.email;
          token.role = dbUser.role;
          token.username = dbUser.username;
          const safeImage = safeSessionImageUrl(dbUser.avatarUrl ?? dbUser.image);
          if (safeImage) {
            token.picture = safeImage;
          } else {
            delete token.picture;
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = token.email ?? session.user.email;
        session.user.role = token.role as Role | undefined;
        session.user.username = token.username as string | null | undefined;
        session.user.image = safeSessionImageUrl(token.picture) ?? null;
      }

      return session;
    }
  }
});
