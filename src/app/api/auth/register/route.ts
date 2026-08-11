import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getRequestIp, json, parseJson, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { ADULT_CONSENT_VERSION } from "@/lib/adult-consent";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:register"
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
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
