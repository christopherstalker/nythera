import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { reportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, reportSchema);
    const message = await prisma.message.findUnique({
      where: { id: context.params.id },
      include: {
        chat: {
          select: {
            characterId: true
          }
        }
      }
    });

    if (!message) {
      throw new HttpError(404, "Message not found.");
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        messageId: message.id,
        characterId: message.chat.characterId,
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
