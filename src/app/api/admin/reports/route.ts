import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, parseJson, requirePlatformAdmin, requireUser, routeError } from "@/lib/api";

const reportUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"]),
  blockCharacter: z.boolean().optional(),
  banUser: z.boolean().optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    requirePlatformAdmin(user);

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        character: {
          select: {
            id: true,
            name: true,
            creatorId: true,
            visibility: true,
            moderationStatus: true
          }
        },
        message: {
          select: {
            id: true,
            content: true,
            flagged: true
          }
        }
      }
    });

    return json({ reports });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    requirePlatformAdmin(user);
    const input = await parseJson(request, reportUpdateSchema);

    const report = await prisma.report.update({
      where: { id: input.id },
      data: { status: input.status },
      include: {
        character: true,
        message: true
      }
    });

    if (input.blockCharacter && report.characterId) {
      await prisma.character.update({
        where: { id: report.characterId },
        data: {
          blockedAt: new Date(),
          moderationStatus: "BLOCKED"
        }
      });
    }

    if (input.banUser && report.character?.creatorId) {
      await prisma.user.update({
        where: { id: report.character.creatorId },
        data: {
          bannedAt: new Date(),
          banReason: `Moderation report ${report.id}: ${report.reason}`.slice(0, 2000)
        }
      });
    }

    return json({ report });
  } catch (error) {
    return routeError(error);
  }
}
