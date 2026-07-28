import { getRequestIp, HttpError, json, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, context: Context) {
  try {
    await enforceRateLimit({ ip: getRequestIp(request), route: "shares:read" });
    const share = await prisma.chatShare.findUnique({
      where: { id: context.params.id }
    });

    if (!share || (share.expiresAt && share.expiresAt.getTime() < Date.now())) {
      throw new HttpError(404, "Share not found.");
    }

    return json({ share }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return routeError(error);
  }
}
