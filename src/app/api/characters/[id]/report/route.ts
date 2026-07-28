import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { reportSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "characters:report" });
    const input = await parseJson(request, reportSchema);
    const character = await prisma.character.findUnique({
      where: { id: context.params.id },
      select: { id: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
    }
    const duplicate = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        characterId: character.id,
        messageId: null,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) }
      },
      select: { id: true }
    });
    if (duplicate) {
      throw new HttpError(409, "You already reported this character recently.");
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        characterId: character.id,
        reason: input.reason,
        details: input.details
      }
    });

    await enqueueJob("process-report", { reportId: report.id });

    return json({ report }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
