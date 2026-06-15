import { z } from "zod";
import { HttpError, json, parseJson, routeError } from "@/lib/api";
import { requireMobileUser } from "@/lib/mobile-auth";
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

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const persona = await prisma.userPersona.findUnique({ where: { userId: user.id } });
    return json({ persona, ...normalizePersonaProfiles(persona) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireMobileUser(request);
    const input = await parseJson(request, userPersonaUpsertSchema);
    const existing = await prisma.userPersona.findUnique({ where: { userId: user.id } });
    const normalized = normalizePersonaProfiles(existing);
    const profileId = input.profileId ?? normalized.activeProfileId ?? createPersonaProfileId();
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
    const profiles = [nextProfile, ...normalized.profiles.filter((profile) => profile.id !== nextProfile.id)];

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
    const user = await requireMobileUser(request);
    const input = await parseJson(request, userPersonaSwitchSchema);
    const persona = await prisma.userPersona.findUnique({ where: { userId: user.id } });
    const normalized = normalizePersonaProfiles(persona);
    const activeProfile = normalized.profiles.find((profile) => profile.id === input.activeProfileId);

    if (!persona || !activeProfile) {
      throw new HttpError(404, "Persona profile not found.");
    }

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
