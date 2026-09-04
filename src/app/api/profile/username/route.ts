import { getRequestIp, json, routeError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    await enforceRateLimit({ userId, ip: getRequestIp(request), route: "profile:username" });

    const value = new URL(request.url).searchParams.get("value") ?? "";
    const username = normalizeUsername(value);
    const reason = usernameValidationMessage(username);

    if (reason) {
      return json({ username, available: false, reason });
    }

    const owner = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" }
      },
      select: { id: true }
    });

    return json({
      username,
      available: !owner || owner.id === userId,
      reason: owner && owner.id !== userId ? "That username is already taken." : null
    });
  } catch (error) {
    return routeError(error);
  }
}
