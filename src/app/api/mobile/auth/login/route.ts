import bcrypt from "bcryptjs";
import { z } from "zod";
import { json, parseJson, routeError, HttpError } from "@/lib/api";
import { createMobileToken, publicMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const mobileLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, mobileLoginSchema);
    const email = input.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true }
    });

    if (!user?.passwordCredential || user.bannedAt) {
      throw new HttpError(401, "Invalid email or password.");
    }

    const valid = await bcrypt.compare(input.password, user.passwordCredential.passwordHash);
    if (!valid) {
      throw new HttpError(401, "Invalid email or password.");
    }

    return json({
      token: createMobileToken(user),
      user: publicMobileUser(user),
      expiresIn: 30 * 24 * 60 * 60
    });
  } catch (error) {
    return routeError(error);
  }
}
