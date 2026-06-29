import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { deleteRoomForUser, getRoomForUser, patchRoomForUser } from "@/lib/rooms";
import { roomPatchSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const room = await getRoomForUser(context.params.id, user.id);
    return json({ room });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, roomPatchSchema);
    const room = await patchRoomForUser(context.params.id, user.id, input);
    return json({ room });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    await deleteRoomForUser(context.params.id, user.id);
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
