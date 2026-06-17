import { z } from "zod";
import { json, parseJson, requireUser, routeError, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userPersonaSchema } from "@/lib/validation";
import {
  buildPersonaMetadata,
  createPersonaProfileId,
  normalizePersonaProfiles,
  type UserPersonaProfile
} from "@/lib/user-persona-profiles";

export const dynamic = "force-dynamic";

const userPersonaUpsertSchema = userPersonaSchema.extend({
  profileId: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(80).optional()
});

const userPersonaSwitchSchema = z.object({
  activeProfileId: z.string().trim().min(1).max(80)
});

const userPersonaDeleteSchema = z.object({
  profileId: z.string().trim().min(1).max(80).optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const persona = await prisma.userPersona.findUnique({
      where: { userId: user.id }
    });

    const normalized = normalizePersonaProfiles(persona);
    return json({ persona, ...normalized });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, userPersonaUpsertSchema);
    const existing = await prisma.userPersona.findUnique({ where: { userId: user.id } });
    const normalized = normalizePersonaProfiles(existing);
    const profileId = input.profileId ?? createPersonaProfileId();
    const nextProfile: UserPersonaProfile = {
      id: profileId,
      label: input.label || input.displayName,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl || null,
      summary: input.summary,
      background: input.background || null,
      traits: input.traits,
      likes: input.likes,
      dislikes: input.dislikes,
      boundaries: input.boundaries,
      visibility: input.visibility
    };
    const profiles = mergeProfile(normalized.profiles, nextProfile);

    const persona = await prisma.userPersona.upsert({
      where: { userId: user.id },
      update: {
        ...profileToData(nextProfile),
        metadata: buildPersonaMetadata(profiles, profileId)
      },
      create: {
        userId: user.id,
        ...profileToData(nextProfile),
        metadata: buildPersonaMetadata(profiles, profileId)
      }
    });

    return json({ persona, ...normalizePersonaProfiles(persona) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, userPersonaSwitchSchema);
    const persona = await prisma.userPersona.findUnique({ where: { userId: user.id } });
    const normalized = normalizePersonaProfiles(persona);
    const activeProfile = normalized.profiles.find((profile) => profile.id === input.activeProfileId);

    if (!persona || !activeProfile) {
      throw new HttpError(404, "Persona profile not found.");
    }

    // The active profile is copied to the canonical persona columns so prompt assembly and the proxy read it directly.
    const updated = await prisma.userPersona.update({
      where: { userId: user.id },
      data: {
        ...profileToData(activeProfile),
        metadata: buildPersonaMetadata(normalized.profiles, activeProfile.id)
      }
    });

    return json({ persona: updated, ...normalizePersonaProfiles(updated) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const input = userPersonaDeleteSchema.parse((await request.json().catch(() => ({}))) ?? {});

    if (!input.profileId) {
      await prisma.userPersona.deleteMany({ where: { userId: user.id } });
      return json({ ok: true, profiles: [] });
    }

    const persona = await prisma.userPersona.findUnique({ where: { userId: user.id } });
    const normalized = normalizePersonaProfiles(persona);
    const profiles = normalized.profiles.filter((profile) => profile.id !== input.profileId);

    if (!persona || profiles.length === normalized.profiles.length) {
      throw new HttpError(404, "Persona profile not found.");
    }

    if (profiles.length === 0) {
      await prisma.userPersona.delete({ where: { userId: user.id } });
      return json({ ok: true, profiles: [] });
    }

    const nextActive = normalized.activeProfileId === input.profileId
      ? profiles[0]
      : profiles.find((profile) => profile.id === normalized.activeProfileId) ?? profiles[0];
    const updated = await prisma.userPersona.update({
      where: { userId: user.id },
      data: {
        ...profileToData(nextActive),
        metadata: buildPersonaMetadata(profiles, nextActive.id)
      }
    });

    return json({ ok: true, persona: updated, ...normalizePersonaProfiles(updated) });
  } catch (error) {
    return routeError(error);
  }
}

function mergeProfile(profiles: UserPersonaProfile[], nextProfile: UserPersonaProfile) {
  const next = profiles.filter((profile) => profile.id !== nextProfile.id);
  next.unshift(nextProfile);
  return next;
}

function profileToData(profile: UserPersonaProfile) {
  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || null,
    summary: profile.summary,
    background: profile.background || null,
    traits: profile.traits,
    likes: profile.likes,
    dislikes: profile.dislikes,
    boundaries: profile.boundaries,
    visibility: profile.visibility
  };
}
