import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const macroSchema = z.object({ name: z.string().trim().min(1).max(32).regex(/^[a-z0-9_-]+$/i), content: z.string().trim().min(1).max(4000) });

export async function GET() {
  try {
    const user = await requireUser();
    return json({ macros: await prisma.chatMacro.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, macroSchema);
    const macro = await prisma.chatMacro.upsert({ where: { userId_name: { userId: user.id, name: input.name.toLowerCase() } }, create: { userId: user.id, name: input.name.toLowerCase(), content: input.content }, update: { content: input.content } });
    return json({ macro }, { status: 201 });
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "id is required.");
    await prisma.chatMacro.deleteMany({ where: { id, userId: user.id } });
    return json({ ok: true });
  } catch (error) { return routeError(error); }
}
