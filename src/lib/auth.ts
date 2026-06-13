import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const providers = [
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      })
    : null,
  env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
    ? Apple({
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET
      })
    : null,
  env.EMAIL_SERVER && env.EMAIL_FROM
    ? Nodemailer({
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
        image: user.avatarUrl ?? user.image,
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
          token.picture = dbUser.avatarUrl ?? dbUser.image ?? token.picture;
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
      }

      return session;
    }
  }
});
