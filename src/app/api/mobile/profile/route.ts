import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError, json, parseJson, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publicMobileUser, requireMobileUser } from "@/lib/mobile-auth";
import { imageSourceSchema } from "@/lib/validation";
import { usernameSchema } from "@/lib/username";

const mobileProfileSchema = z.object({
  username: usernameSchema.optional().or(z.literal("")).nullable(),
  bio: z.string().max(800).optional().nullable(),
  avatarUrl: imageSourceSchema.optional().or(z.literal("")).nullable(),
  ageVerified: z.boolean().optional(),
  memoryEnabled: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional()
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
    return json({ user: publicMobileUser(user) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const input = await parseJson(request, mobileProfileSchema);
    if (input.username) {
      const owner = await prisma.user.findFirst({
        where: {
          id: { not: user.id },
          username: { equals: input.username, mode: "insensitive" }
        },
        select: { id: true }
      });
      if (owner) throw new HttpError(409, "That username is already taken.");
    }
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: input.username === "" ? null : input.username,
        bio: input.bio,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        ageVerified: input.ageVerified,
        memoryEnabled: input.memoryEnabled,
        compactMode: input.compactMode,
        notificationsEnabled: input.notificationsEnabled
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        image: true,
        avatarUrl: true,
        bio: true,
        role: true,
        ageVerified: true,
        memoryEnabled: true,
        compactMode: true,
        notificationsEnabled: true
      }
    });

    return json({ user: publicMobileUser(profile) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ error: "That username is already taken." }, { status: 409 });
    }
    return routeError(error);
  }
}
