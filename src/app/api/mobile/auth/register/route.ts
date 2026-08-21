import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getRequestIp, json, parseJson, routeError, HttpError } from "@/lib/api";
import { createMobileToken, publicMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { ADULT_CONSENT_VERSION } from "@/lib/adult-consent";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "mobile-auth:register"
    });
    const input = await parseJson(request, registerSchema);
    await verifyTurnstile({ token: input.turnstileToken, action: "register", remoteIp: getRequestIp(request) });
    const email = input.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username: input.username,
          name: input.username,
          adultTermsAcceptedAt: new Date(),
          adultTermsVersion: ADULT_CONSENT_VERSION
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
