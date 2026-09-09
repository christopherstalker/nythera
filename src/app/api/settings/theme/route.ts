import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { appAppearanceSchema, parseAppAppearance } from "@/lib/app-appearance";

const updateSchema = z.object({ appearance: appAppearanceSchema.nullable() }).strict();
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const user = await requireUser();
    const preferences = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { appAppearance: true }
    });
    return json({ appearance: parseAppAppearance(preferences.appAppearance) }, { headers: privateHeaders });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, updateSchema, { maxBytes: 16 * 1024 });
    await prisma.user.update({ where: { id: user.id }, data: { appAppearance: input.appearance ?? Prisma.DbNull } });
    return json({ appearance: input.appearance }, { headers: privateHeaders });
  } catch (error) {
    return routeError(error);
  }
}
