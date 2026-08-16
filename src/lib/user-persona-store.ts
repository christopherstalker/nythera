import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { normalizePersonaRows } from "@/lib/user-persona-profiles";

type PersonaInput = {
  profileId?: string;
  label?: string;
  displayName: string;
  avatarUrl?: string | null;
  summary: string;
  background?: string | null;
  traits: string[];
  likes: string[];
  dislikes: string[];
  boundaries: string[];
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
};

export async function getUserPersonaState(userId: string, chatId?: string | null) {
  const [personas, chat] = await Promise.all([
    prisma.userPersona.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),
    chatId
      ? prisma.chat.findFirst({
          where: { id: chatId, userId },
          select: { personaId: true, temporaryPersonaId: true, characterId: true }
        })
      : Promise.resolve(null)
  ]);

  const characterPreference = chat
    ? await prisma.characterPersonaPreference.findUnique({
        where: { userId_characterId: { userId, characterId: chat.characterId } },
        select: { personaId: true }
      })
    : null;
  const activePersonaId = chat?.temporaryPersonaId ?? chat?.personaId ?? null;

  return {
    persona: personas.find((persona) => persona.id === activePersonaId) ?? personas.find((persona) => persona.isDefault) ?? personas[0] ?? null,
    temporaryProfileId: chat?.temporaryPersonaId ?? null,
    characterDefaultProfileId: characterPreference?.personaId ?? null,
    ...normalizePersonaRows(personas, activePersonaId)
  };
}

export async function getDefaultPersonaId(userId: string) {
  const persona = await prisma.userPersona.findFirst({
    where: { userId, isDefault: true },
    select: { id: true }
  });

  return persona?.id ?? null;
}

export async function getPreferredPersonaId(userId: string, characterId: string) {
  const preference = await prisma.characterPersonaPreference.findUnique({
    where: { userId_characterId: { userId, characterId } },
    select: { personaId: true }
  });
  return preference?.personaId ?? getDefaultPersonaId(userId);
}

export async function saveUserPersona(userId: string, input: PersonaInput, chatId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const existingPersonas = await tx.userPersona.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
    const existing = input.profileId
      ? existingPersonas.find((persona) => persona.id === input.profileId)
      : null;
    const shouldBecomeDefault = existingPersonas.length === 0;

    let saved;
    if (existing) {
      await createPersonaRevision(tx, existing);
      saved = await tx.userPersona.update({
        where: { id: existing.id },
        data: personaInputToData(input)
      });
    } else {
      saved = await tx.userPersona.create({
        data: {
          userId,
          ...personaInputToData(input),
          isDefault: false
        }
      });
      await createPersonaRevision(tx, saved);
    }

    if (shouldBecomeDefault) {
      await setDefaultPersona(tx, userId, saved.id);
      saved = { ...saved, isDefault: true };
    }

    if (chatId) {
      const updated = await tx.chat.updateMany({
        where: { id: chatId, userId },
        data: { personaId: saved.id }
      });
      if (updated.count === 0) {
        throw new HttpError(404, "Chat not found.");
      }
    }

    if (chatId) {
      await tx.user.update({
        where: { id: userId },
        data: { lastPersonaId: saved.id }
      });
    }

    return personaStateInTransaction(tx, userId, chatId ?? null, saved.id);
  });
}

export async function activateUserPersona(userId: string, personaId: string, chatId: string) {
  return prisma.$transaction(async (tx) => {
    const persona = await tx.userPersona.findFirst({
      where: { id: personaId, userId }
    });

    if (!persona) {
      throw new HttpError(404, "Persona profile not found.");
    }

    const updated = await tx.chat.updateMany({
      where: { id: chatId, userId },
      data: { personaId: persona.id, temporaryPersonaId: null }
    });
    if (updated.count === 0) {
      throw new HttpError(404, "Chat not found.");
    }

    await tx.user.update({
      where: { id: userId },
      data: { lastPersonaId: persona.id }
    });

    return personaStateInTransaction(tx, userId, chatId);
  });
}

export async function activateTemporaryUserPersona(userId: string, personaId: string, chatId: string) {
  return prisma.$transaction(async (tx) => {
    const persona = await tx.userPersona.findFirst({ where: { id: personaId, userId }, select: { id: true } });
    if (!persona) throw new HttpError(404, "Persona profile not found.");

    const updated = await tx.chat.updateMany({
      where: { id: chatId, userId },
      data: { temporaryPersonaId: persona.id }
    });
    if (!updated.count) throw new HttpError(404, "Chat not found.");
    return personaStateInTransaction(tx, userId, chatId, persona.id);
  });
}

export async function setCharacterDefaultPersona(userId: string, characterId: string, personaId: string | null) {
  return prisma.$transaction(async (tx) => {
    const character = await tx.character.findUnique({ where: { id: characterId }, select: { id: true } });
    if (!character) throw new HttpError(404, "Character not found.");

    if (!personaId) {
      await tx.characterPersonaPreference.deleteMany({ where: { userId, characterId } });
      return { ok: true, characterDefaultProfileId: null };
    }

    const persona = await tx.userPersona.findFirst({ where: { id: personaId, userId }, select: { id: true } });
    if (!persona) throw new HttpError(404, "Persona profile not found.");
    await tx.characterPersonaPreference.upsert({
      where: { userId_characterId: { userId, characterId } },
      create: { userId, characterId, personaId },
      update: { personaId }
    });
    return { ok: true, characterDefaultProfileId: personaId };
  });
}

export async function listPersonaRevisions(userId: string, personaId: string) {
  const persona = await prisma.userPersona.findFirst({ where: { id: personaId, userId }, select: { id: true } });
  if (!persona) throw new HttpError(404, "Persona profile not found.");
  return prisma.userPersonaRevision.findMany({
    where: { personaId },
    orderBy: { version: "desc" },
    take: 30
  });
}

export async function restorePersonaRevision(userId: string, personaId: string, revisionId: string) {
  return prisma.$transaction(async (tx) => {
    const persona = await tx.userPersona.findFirst({ where: { id: personaId, userId } });
    if (!persona) throw new HttpError(404, "Persona profile not found.");
    const revision = await tx.userPersonaRevision.findFirst({ where: { id: revisionId, personaId } });
    if (!revision) throw new HttpError(404, "Persona version not found.");
    await createPersonaRevision(tx, persona);
    const snapshot = revision.snapshot as Record<string, unknown>;
    return tx.userPersona.update({
      where: { id: persona.id },
      data: {
        label: typeof snapshot.label === "string" ? snapshot.label : persona.label,
        displayName: typeof snapshot.displayName === "string" ? snapshot.displayName : persona.displayName,
        avatarUrl: typeof snapshot.avatarUrl === "string" ? snapshot.avatarUrl : null,
        summary: typeof snapshot.summary === "string" ? snapshot.summary : persona.summary,
        background: typeof snapshot.background === "string" ? snapshot.background : null,
        traits: stringArray(snapshot.traits),
        likes: stringArray(snapshot.likes),
        dislikes: stringArray(snapshot.dislikes),
        boundaries: stringArray(snapshot.boundaries)
      }
    });
  });
}

export async function setDefaultUserPersona(userId: string, personaId: string | null) {
  return prisma.$transaction(async (tx) => {
    if (personaId) {
      const persona = await tx.userPersona.findFirst({
        where: { id: personaId, userId },
        select: { id: true }
      });
      if (!persona) {
        throw new HttpError(404, "Persona profile not found.");
      }
    }

    await tx.userPersona.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
    if (personaId) {
      await tx.userPersona.update({
        where: { id: personaId },
        data: { isDefault: true }
      });
    }

    return personaStateInTransaction(tx, userId, null, personaId);
  });
}

export async function deleteUserPersona(userId: string, personaId?: string | null) {
  return prisma.$transaction(async (tx) => {
    if (!personaId) {
      await tx.userPersona.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: { lastPersonaId: null }
      });
      return {
        ok: true,
        persona: null,
        profiles: [],
        defaultProfileId: null,
        defaultProfile: null,
        activeProfileId: null,
        activeProfile: null
      };
    }

    const persona = await tx.userPersona.findFirst({
      where: { id: personaId, userId }
    });
    if (!persona) {
      throw new HttpError(404, "Persona profile not found.");
    }

    await tx.userPersona.delete({ where: { id: persona.id } });

    const account = await tx.user.findUnique({
      where: { id: userId },
      select: { lastPersonaId: true }
    });
    if (account?.lastPersonaId === persona.id) {
      const replacement = await tx.userPersona.findFirst({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { id: true }
      });
      await tx.user.update({
        where: { id: userId },
        data: { lastPersonaId: replacement?.id ?? null }
      });
    }

    return { ok: true, ...(await personaStateInTransaction(tx, userId, null)) };
  });
}

async function personaStateInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  chatId: string | null,
  preferredActivePersonaId?: string | null
) {
  const [personas, chat] = await Promise.all([
    tx.userPersona.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),
    chatId
      ? tx.chat.findFirst({
          where: { id: chatId, userId },
          select: { personaId: true, temporaryPersonaId: true }
        })
      : Promise.resolve(null)
  ]);
  return {
    persona:
      personas.find((persona) => persona.id === (preferredActivePersonaId ?? chat?.temporaryPersonaId ?? chat?.personaId))
      ?? personas.find((persona) => persona.isDefault)
      ?? personas[0]
      ?? null,
    temporaryProfileId: chat?.temporaryPersonaId ?? null,
    ...normalizePersonaRows(personas, preferredActivePersonaId ?? chat?.temporaryPersonaId ?? chat?.personaId ?? null)
  };
}

async function setDefaultPersona(tx: Prisma.TransactionClient, userId: string, personaId: string) {
  await tx.userPersona.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false }
  });
  await tx.userPersona.update({
    where: { id: personaId },
    data: { isDefault: true }
  });
}

function personaInputToData(input: PersonaInput) {
  return {
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
}

async function createPersonaRevision(tx: Prisma.TransactionClient, persona: {
  id: string;
  label: string | null;
  displayName: string;
  avatarUrl: string | null;
  summary: string;
  background: string | null;
  traits: string[];
  likes: string[];
  dislikes: string[];
  boundaries: string[];
}) {
  const latest = await tx.userPersonaRevision.findFirst({
    where: { personaId: persona.id },
    orderBy: { version: "desc" },
    select: { version: true }
  });
  await tx.userPersonaRevision.create({
    data: {
      personaId: persona.id,
      version: (latest?.version ?? 0) + 1,
      snapshot: {
        label: persona.label,
        displayName: persona.displayName,
        avatarUrl: persona.avatarUrl,
        summary: persona.summary,
        background: persona.background,
        traits: persona.traits,
        likes: persona.likes,
        dislikes: persona.dislikes,
        boundaries: persona.boundaries
      }
    }
  });
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
