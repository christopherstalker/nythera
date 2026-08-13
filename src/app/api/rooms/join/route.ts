import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const joinSchema = z.object({ code: z.string().trim().min(8).max(100) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { code } = await parseJson(request, joinSchema);
    const room = await prisma.room.findUnique({ where: { inviteCode: code }, select: { id: true, userId: true, archivedAt: true } });
    if (!room || room.archivedAt) throw new HttpError(404, "Room invite is no longer available.");
    if (room.userId !== user.id) await prisma.roomMember.upsert({ where: { roomId_userId: { roomId: room.id, userId: user.id } }, create: { roomId: room.id, userId: user.id }, update: {} });
    return json({ roomId: room.id });
  } catch (error) { return routeError(error); }
}
