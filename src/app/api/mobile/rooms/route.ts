import { getRequestIp, json, parseJson, routeError } from "@/lib/api";
import { requireMobileUser } from "@/lib/mobile-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createRoomForUser, listRoomsForUser } from "@/lib/rooms";
import { roomCreateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const rooms = await listRoomsForUser(user.id);
    return json({ rooms });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser(request);
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "mobile:rooms:create"
    });

    const input = await parseJson(request, roomCreateSchema);
    const room = await createRoomForUser(user, input);
    return json({ room }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
