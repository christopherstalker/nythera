import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createRoomForUser, listRoomsForUser } from "@/lib/rooms";
import { roomCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser();
    const rooms = await listRoomsForUser(user.id);
    return json({ rooms });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "rooms:create"
    });

    const input = await parseJson(request, roomCreateSchema);
    const room = await createRoomForUser(user, input);
    return json({ room }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
