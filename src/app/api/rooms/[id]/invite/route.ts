import crypto from "crypto";
import { HttpError, json, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const existing = await prisma.room.findFirst({ where: { id, userId: user.id }, select: { inviteCode: true } });
    if (!existing) throw new HttpError(404, "Room not found.");
    const inviteCode = existing.inviteCode || crypto.randomBytes(12).toString("base64url");
    if (!existing.inviteCode) await prisma.room.update({ where: { id }, data: { inviteCode } });
    return json({ inviteCode });
  } catch (error) { return routeError(error); }
}
