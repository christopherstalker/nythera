import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  getRequestIp,
  HttpError,
  json,
  parseJson,
  routeError,
} from "@/lib/api";
import {
  createMobileToken,
  publicMobileUser,
  requireMobileUser,
} from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const updatePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8).max(128),
});

export async function PUT(request: Request) {
  try {
    const user = await requireMobileUser(request);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:account:password",
    });
    const input = await parseJson(request, updatePasswordSchema);
    const credential = await prisma.passwordCredential.findUnique({
      where: { userId: user.id },
    });
    if (credential) {
      const valid = input.currentPassword
        ? await bcrypt.compare(input.currentPassword, credential.passwordHash)
        : false;
      if (!valid) throw new HttpError(400, "Current password is incorrect.");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.passwordCredential.upsert({
        where: { userId: user.id },
        update: { passwordHash },
        create: { userId: user.id, passwordHash },
      });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return tx.user.update({
        where: { id: user.id },
        data: { authVersion: { increment: 1 } },
      });
    });

    return json({
      token: createMobileToken(updatedUser),
      user: publicMobileUser(updatedUser),
      expiresIn: 30 * 24 * 60 * 60,
    });
  } catch (error) {
    return routeError(error);
  }
}
