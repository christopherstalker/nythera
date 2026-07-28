import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { reportSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "messages:report" });
    const input = await parseJson(request, reportSchema);
    const message = await prisma.message.findFirst({
      where: {
        id: context.params.id,
        chat: {
          userId: user.id
        }
      },
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
    const duplicate = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        messageId: message.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) }
      },
      select: { id: true }
    });
    if (duplicate) {
      throw new HttpError(409, "You already reported this message recently.");
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
