import "server-only";

import { createHash, randomBytes } from "crypto";
import { createTransport } from "nodemailer-safe";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export async function createPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true },
  });
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  await sendResetEmail(user.email, token);
}

export async function consumePasswordReset(
  token: string,
  passwordHash: string,
) {
  const tokenHash = hashResetToken(token);
  return prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (!resetToken || resetToken.expiresAt <= new Date()) {
      return false;
    }

    const claimed = await tx.passwordResetToken.deleteMany({
      where: { id: resetToken.id, expiresAt: { gt: new Date() } },
    });
    if (claimed.count === 0) {
      return false;
    }

    await tx.passwordCredential.upsert({
      where: { userId: resetToken.userId },
      update: { passwordHash },
      create: { userId: resetToken.userId, passwordHash },
    });
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { authVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    });
    return true;
  });
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(email: string, token: string) {
  if (!env.EMAIL_SERVER || !env.EMAIL_FROM) {
    throw new Error("Password reset email is not configured.");
  }

  const appUrl = env.AUTH_URL || env.NEXTAUTH_URL;
  if (!appUrl) {
    throw new Error("Application URL is not configured.");
  }

  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", token);
  const transport = createTransport(env.EMAIL_SERVER);
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Reset your Nythera password",
    text: `Use this link within 30 minutes to reset your Nythera password:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use the link below within 30 minutes to reset your Nythera password.</p><p><a href="${escapeHtml(
      resetUrl.toString(),
    )}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}
