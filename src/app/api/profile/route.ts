import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { imageSourceSchema } from "@/lib/validation";

const profileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional()
    .or(z.literal(""))
    .nullable(),
  bio: z.string().max(800).optional().nullable(),
  avatarUrl: imageSourceSchema.optional().or(z.literal("")).nullable(),
  ageVerified: z.boolean().optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        role: true,
        ageVerified: true
      }
    });

    return json({ profile });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, profileSchema);
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: input.username === "" ? null : input.username,
        bio: input.bio,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        ageVerified: input.ageVerified
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        role: true,
        ageVerified: true
      }
    });

    return json({ profile });
  } catch (error) {
    return routeError(error);
  }
}
