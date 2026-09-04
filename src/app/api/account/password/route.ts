import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  getRequestIp,
  HttpError,
  json,
  parseJson,
  requireUser,
  routeError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const updatePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8).max(128),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const credential = await prisma.passwordCredential.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return json({ hasPassword: Boolean(credential) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "account:password",
    });
    const input = await parseJson(request, updatePasswordSchema);
    const credential = await prisma.passwordCredential.findUnique({
      where: { userId: user.id },
    });
    if (credential) {
      const valid = input.currentPassword
        ? await bcrypt.compare(input.currentPassword, credential.passwordHash)
        : false;
      if (!valid) {
        throw new HttpError(400, "Current password is incorrect.");
      }
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.$transaction([
      prisma.passwordCredential.upsert({
        where: { userId: user.id },
        update: { passwordHash },
        create: { userId: user.id, passwordHash },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { authVersion: { increment: 1 } },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
