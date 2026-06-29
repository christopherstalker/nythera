import { json, parseJson, routeError } from "@/lib/api";
import { requireMobileUser } from "@/lib/mobile-auth";
import { deleteRoomForUser, getRoomForUser, patchRoomForUser } from "@/lib/rooms";
import { roomPatchSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    const room = await getRoomForUser(context.params.id, user.id);
    return json({ room });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    const input = await parseJson(request, roomPatchSchema);
    const room = await patchRoomForUser(context.params.id, user.id, input);
    return json({ room });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireMobileUser(request);
    await deleteRoomForUser(context.params.id, user.id);
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
