import { z } from "zod";
import { json, parseJson, routeError } from "@/lib/api";
import { createMobileToken, findOrCreateGoogleMobileUser, publicMobileUser, verifyGoogleIdToken } from "@/lib/mobile-auth";

const googleMobileAuthSchema = z.object({
  idToken: z.string().min(40)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
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
