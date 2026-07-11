import { z } from "zod";
import { getRequestIp, json, parseJson, routeError } from "@/lib/api";
import { createMobileToken, findOrCreateGoogleMobileUser, publicMobileUser, verifyGoogleIdToken } from "@/lib/mobile-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const googleMobileAuthSchema = z.object({
  idToken: z.string().min(40)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "mobile-auth:google"
    });

    const input = await parseJson(request, googleMobileAuthSchema);
    const google = await verifyGoogleIdToken(input.idToken);
    const user = await findOrCreateGoogleMobileUser(google);
    const token = createMobileToken(user);

    return json({
      token,
      user: publicMobileUser(user),
      expiresIn: 30 * 24 * 60 * 60
    });
  } catch (error) {
    return routeError(error);
  }
}
