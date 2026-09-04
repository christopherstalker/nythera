import { z } from "zod";
import { getRequestIp, json, parseJson, routeError } from "@/lib/api";
import { createPasswordReset } from "@/lib/password-reset";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logSafeError } from "@/lib/secret-redaction";

const forgotPasswordSchema = z.object({ email: z.string().email().max(320) });

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:forgot-password",
    });
    const input = await parseJson(request, forgotPasswordSchema);
    try {
      await createPasswordReset(input.email);
    } catch (error) {
      logSafeError("Password reset delivery failed.", error);
    }
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
