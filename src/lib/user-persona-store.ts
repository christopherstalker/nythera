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
          select: { personaId: true }
        })
      : Promise.resolve(null)
  ]);

  return {
    persona: personas.find((persona) => persona.id === chat?.personaId) ?? personas.find((persona) => persona.isDefault) ?? personas[0] ?? null,
    ...normalizePersonaRows(personas, chat?.personaId ?? null)
  };
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
    const shouldBecomeDefault = !chatId || existingPersonas.length === 0 || existing?.isDefault === true;

    let saved;
    if (existing) {
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

    return personaStateInTransaction(tx, userId, chatId ?? null);
  });
}

export async function activateUserPersona(userId: string, personaId: string, chatId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const persona = await tx.userPersona.findFirst({
      where: { id: personaId, userId }
    });

    if (!persona) {
      throw new HttpError(404, "Persona profile not found.");
    }

    if (chatId) {
      const updated = await tx.chat.updateMany({
        where: { id: chatId, userId },
        data: { personaId: persona.id }
      });
      if (updated.count === 0) {
        throw new HttpError(404, "Chat not found.");
      }
    } else {
      await setDefaultPersona(tx, userId, persona.id);
    }

    return personaStateInTransaction(tx, userId, chatId ?? null);
  });
}

export async function deleteUserPersona(userId: string, personaId?: string | null) {
  return prisma.$transaction(async (tx) => {
    if (!personaId) {
      await tx.userPersona.deleteMany({ where: { userId } });
      return { ok: true, persona: null, profiles: [], activeProfileId: null, activeProfile: null };
    }

    const persona = await tx.userPersona.findFirst({
      where: { id: personaId, userId }
    });
    if (!persona) {
      throw new HttpError(404, "Persona profile not found.");
    }

    await tx.userPersona.delete({ where: { id: persona.id } });

    if (persona.isDefault) {
      const nextDefault = await tx.userPersona.findFirst({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }]
      });
      if (nextDefault) {
        await setDefaultPersona(tx, userId, nextDefault.id);
      }
    }

    return { ok: true, ...(await personaStateInTransaction(tx, userId, null)) };
  });
}

async function personaStateInTransaction(tx: Prisma.TransactionClient, userId: string, chatId: string | null) {
  const [personas, chat] = await Promise.all([
    tx.userPersona.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),
    chatId
      ? tx.chat.findFirst({
          where: { id: chatId, userId },
          select: { personaId: true }
        })
      : Promise.resolve(null)
  ]);
  return {
    persona: personas.find((persona) => persona.id === chat?.personaId) ?? personas.find((persona) => persona.isDefault) ?? personas[0] ?? null,
    ...normalizePersonaRows(personas, chat?.personaId ?? null)
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
