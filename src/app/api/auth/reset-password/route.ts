import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  getRequestIp,
  HttpError,
  json,
  parseJson,
  routeError,
} from "@/lib/api";
import { consumePasswordReset } from "@/lib/password-reset";
import { enforceRateLimit } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:reset-password",
    });
    const input = await parseJson(request, resetPasswordSchema);
    const passwordHash = await bcrypt.hash(input.password, 12);
    if (!(await consumePasswordReset(input.token, passwordHash))) {
      throw new HttpError(
        400,
        "This password reset link is invalid or has expired.",
      );
    }
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
