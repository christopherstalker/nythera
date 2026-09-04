import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { parseProfileSettings } from "@/lib/profile-settings";
import { prisma } from "@/lib/prisma";
import { imageSourceSchema } from "@/lib/validation";
import { resolveMusicEmbed } from "@/lib/music-embed";
import { usernameSchema } from "@/lib/username";

const socialLinkSchema = z.string().trim().max(300).refine((value) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Social links must use a valid HTTPS URL.");

const profileSettingsSchema = z.object({
  bannerUrl: imageSourceSchema.optional().or(z.literal("")).nullable(),
  useGradientBanner: z.boolean().optional(),
  themePreset: z.enum(["midnight", "aurora", "obsidian", "crystal", "ember", "veil"]).optional(),
  layoutStyle: z.enum(["minimal", "showcase", "grid"]).optional(),
  surfaceStyle: z.enum(["glass", "luminous", "editorial"]).optional(),
  avatarShape: z.enum(["circle", "soft", "square"]).optional(),
  bannerHeight: z.enum(["compact", "cinematic", "immersive"]).optional(),
  fontFamily: z.string().trim().min(1).max(120).regex(/^[\p{L}\p{N}\s._-]+$/u).optional(),
  fontUrl: z.string().trim().max(1000).refine((value) => !value || isHttpsUrl(value), "Custom fonts must use HTTPS.").optional(),
  fontScale: z.coerce.number().min(0.85).max(1.3).optional(),
  music: z.object({
    enabled: z.boolean(),
    url: z.string().trim().max(500).refine((value) => !value || Boolean(resolveMusicEmbed(value)), "Use a supported HTTPS music link."),
    title: z.string().trim().max(100)
  }).optional(),
  socialLinks: z.object({
    twitter: socialLinkSchema.optional(),
    patreon: socialLinkSchema.optional(),
    discord: socialLinkSchema.optional()
  }).optional()
}).optional();

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const profileSchema = z.object({
  username: usernameSchema.optional().or(z.literal("")).nullable(),
  bio: z.string().max(800).optional().nullable(),
  avatarUrl: imageSourceSchema.optional().or(z.literal("")).nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  profileSettings: profileSettingsSchema,
  ageVerified: z.boolean().optional(),
  memoryEnabled: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional()
});

const profileSelect = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  bio: true,
  accentColor: true,
  profileSettings: true,
  role: true,
  ageVerified: true,
  memoryEnabled: true,
  compactMode: true,
  notificationsEnabled: true
} as const;

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await prisma.user.findUnique({ where: { id: user.id }, select: profileSelect });
    return json({
      profile: profile
        ? { ...profile, profileSettings: parseProfileSettings(profile.profileSettings) }
        : profile
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, profileSchema);
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
        accentColor: input.accentColor,
        profileSettings: input.profileSettings,
        ageVerified: input.ageVerified,
        memoryEnabled: input.memoryEnabled,
        compactMode: input.compactMode,
        notificationsEnabled: input.notificationsEnabled
      },
      select: profileSelect
    });

    return json({
      profile: { ...profile, profileSettings: parseProfileSettings(profile.profileSettings) }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ error: "That username is already taken." }, { status: 409 });
    }
    return routeError(error);
  }
}
