import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { reportSchema } from "@/lib/validation";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, reportSchema);
    const character = await prisma.character.findUnique({
      where: { id: context.params.id },
      select: { id: true }
    });

    if (!character) {
      throw new HttpError(404, "Character not found.");
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
