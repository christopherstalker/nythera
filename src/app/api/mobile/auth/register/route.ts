import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { json, parseJson, routeError, HttpError } from "@/lib/api";
import { createMobileToken, publicMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, registerSchema);
    const email = input.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username: input.username,
          name: input.username,
          emailVerified: new Date()
        }
      });

      await tx.passwordCredential.create({
        data: {
          userId: created.id,
          passwordHash
        }
      });

      return created;
    });

    return json({
      token: createMobileToken(user),
      user: publicMobileUser(user),
      expiresIn: 30 * 24 * 60 * 60
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeError(new HttpError(409, "Email or username is already taken."));
    }

    return routeError(error);
  }
}
