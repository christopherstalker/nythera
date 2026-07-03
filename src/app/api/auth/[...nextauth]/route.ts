import { handlers } from "@/lib/auth";
import { getRequestIp, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit({
      ip: getRequestIp(request),
      route: "auth:nextauth"
    });
    return handlers.POST(request);
  } catch (error) {
    return routeError(error);
  }
}
