import { getRequestIp, json, parseJson, routeError } from "@/lib/api";
import { requireMobileUser } from "@/lib/mobile-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendRoomMessage } from "@/lib/rooms";
import { roomMessageSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:rooms:message"
    });

    const body = await parseJson(request, roomMessageSchema);
    const result = await sendRoomMessage({
      roomId: context.params.id,
      user,
      body,
      signal: request.signal
    });

    return json(result);
  } catch (error) {
    return routeError(error);
  }
}
