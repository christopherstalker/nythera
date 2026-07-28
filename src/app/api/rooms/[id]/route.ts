import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { deleteRoomForUser, getRoomForUser, patchRoomForUser } from "@/lib/rooms";
import { roomPatchSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "rooms:read" });
    const room = await getRoomForUser((await context.params).id, user.id);
    return json({ room });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, roomPatchSchema);
    const room = await patchRoomForUser((await context.params).id, user.id, input);
    return json({ room });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    await deleteRoomForUser((await context.params).id, user.id);
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
