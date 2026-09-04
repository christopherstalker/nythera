import { Prisma } from "@prisma/client";
import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  TUTORIAL_MEMORY_CHOICES,
  TUTORIAL_PERSONA_CHOICES,
  TUTORIAL_ROUTE_CHOICES,
  TUTORIAL_STEP_COUNT
} from "@/lib/tutorial";

const tutorialProgressSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "SKIPPED"]),
  step: z.number().int().min(0).max(TUTORIAL_STEP_COUNT),
  state: z.object({
    routeChoice: z.enum(TUTORIAL_ROUTE_CHOICES).optional(),
    personaChoice: z.enum(TUTORIAL_PERSONA_CHOICES).optional(),
    memoryChoice: z.enum(TUTORIAL_MEMORY_CHOICES).optional(),
    alternateRouteViewed: z.boolean().optional()
  })
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, tutorialProgressSchema);
    const progress = await prisma.user.update({
      where: { id: user.id },
      data: {
        tutorialStatus: input.status,
        tutorialStep: input.step,
        tutorialState: input.state as Prisma.InputJsonValue,
        tutorialCompletedAt: input.status === "COMPLETED" ? new Date() : null
      },
      select: {
        tutorialStatus: true,
        tutorialStep: true,
        tutorialCompletedAt: true
      }
    });

    return json({ progress });
  } catch (error) {
    return routeError(error);
  }
}
