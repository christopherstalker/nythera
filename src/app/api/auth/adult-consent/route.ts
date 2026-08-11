import { ADULT_CONSENT_VERSION } from "@/lib/adult-consent";
import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { adultConsentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "auth:adult-consent" });
    const input = await parseJson(request, adultConsentSchema);
    await verifyTurnstile({
      token: input.turnstileToken,
      action: "adult_consent",
      remoteIp: getRequestIp(request)
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        adultTermsAcceptedAt: new Date(),
        adultTermsVersion: ADULT_CONSENT_VERSION
      }
    });

    return json({ accepted: true, version: ADULT_CONSENT_VERSION });
  } catch (error) {
    return routeError(error);
  }
}
