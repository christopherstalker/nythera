import "server-only";

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import { HttpError } from "@/lib/api";
import { canonicalizeCharacterPersona } from "@/lib/character-prompt-contract";
import { normalizeCharacterTags } from "@/lib/character-tags";
import { prisma } from "@/lib/prisma";
import { moderateText } from "@/lib/safety";
import { rememberUserTags } from "@/lib/tag-library";
import { characterCreateSchema, characterUpdateSchema } from "@/lib/validation";
import { containsRussianLanguage, RUSSIAN_CHARACTER_PUBLICATION_ERROR } from "@/lib/language-policy";

type CharacterCreateInput = z.infer<typeof characterCreateSchema>;
type CharacterUpdateInput = z.infer<typeof characterUpdateSchema>;
type CharacterMutationUser = {
  id: string;
  role: string;
  ageVerified: boolean;
  birthDate: Date | null;
};

export async function createCharacterForUser(input: CharacterCreateInput, user: CharacterMutationUser) {
  const persona = canonicalizeCharacterPersona(input.name, input.persona);
  assertAgeGate(input.isNSFW, user);
  assertPublicCharacterComplete({
    visibility: input.visibility,
    avatarUrl: input.avatarUrl,
    scenario: input.scenario,
    persona
  });
  assertCharacterLanguageAllowed({
    visibility: input.visibility,
    name: input.name,
    description: input.description,
    personality: input.personality,
    scenario: input.scenario,
    greeting: input.greeting,
    systemPromptOverride: input.systemPromptOverride,
    persona,
    lorebook: input.lorebook
  });
  assertCharacterModeration({
    user,
    name: input.name,
    description: input.description,
    personality: input.personality,
    scenario: input.scenario,
    greeting: input.greeting,
    systemPromptOverride: input.systemPromptOverride,
    persona,
    lorebook: input.lorebook
  });

  const tags = normalizeCharacterTags(input.tags);
  const character = await prisma.$transaction(async (transaction) => {
    const created = await transaction.character.create({
      data: {
        creatorId: user.id,
        creationMode: input.creationMode,
        name: input.name,
        avatarUrl: input.avatarUrl || null,
        description: input.description,
        personality: input.personality,
        scenario: input.scenario,
        greeting: input.greeting,
        communicationStyle: input.communicationStyle ?? Prisma.JsonNull,
        persona: persona ?? Prisma.JsonNull,
        lorebook: input.lorebook ?? Prisma.JsonNull,
        visualIdentity: input.visualIdentity ?? Prisma.JsonNull,
        preferredProvider: input.preferredProvider,
        preferredModel: input.preferredModel,
        temperature: input.temperature,
        topP: input.topP,
        frequencyPenalty: input.frequencyPenalty,
        presencePenalty: input.presencePenalty,
        maxTokens: input.maxTokens,
        systemPromptOverride: input.systemPromptOverride,
        defaultChatMode: input.defaultChatMode,
        visibility: input.visibility,
        tags,
        isNSFW: input.isNSFW,
        moderationStatus: "APPROVED"
      }
    });
    await rememberUserTags(transaction, user.id, tags);
    return created;
  });

  invalidateCharacterDiscovery();
  return character;
}

export async function updateCharacterForUser(characterId: string, input: CharacterUpdateInput, user: CharacterMutationUser) {
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      ...(user.role === "ADMIN" ? {} : { creatorId: user.id })
    },
    select: {
      creatorId: true,
      creationMode: true,
      name: true,
      description: true,
      personality: true,
      scenario: true,
      greeting: true,
      avatarUrl: true,
      visibility: true,
      isNSFW: true,
      persona: true,
      lorebook: true,
      visualIdentity: true,
      systemPromptOverride: true
    }
  });

  if (!character) {
    throw new HttpError(404, "Character not found.");
  }
  if (input.creationMode && input.creationMode !== character.creationMode) {
    throw new HttpError(400, "A character cannot be converted between Simple and Custom modes.");
  }

  const isNSFW = input.isNSFW ?? character.isNSFW;
  const visibility = input.visibility ?? character.visibility;
  const name = input.name ?? character.name;
  const persona = canonicalizeCharacterPersona(name, input.persona === undefined ? character.persona : input.persona);
  const avatarUrl = input.avatarUrl === undefined ? character.avatarUrl : input.avatarUrl;
  const scenario = input.scenario === undefined ? character.scenario : input.scenario;

  assertAgeGate(isNSFW, user);
  assertPublicCharacterComplete({ visibility, avatarUrl, scenario, persona });
  assertCharacterLanguageAllowed({
    visibility,
    name,
    description: input.description ?? character.description,
    personality: input.personality ?? character.personality,
    scenario,
    greeting: input.greeting ?? character.greeting,
    systemPromptOverride: input.systemPromptOverride === undefined ? character.systemPromptOverride : input.systemPromptOverride,
    persona,
    lorebook: input.lorebook ?? character.lorebook
  });
  assertCharacterModeration({
    user,
    name,
    description: input.description ?? character.description,
    personality: input.personality ?? character.personality,
    scenario,
    greeting: input.greeting ?? character.greeting,
    systemPromptOverride: input.systemPromptOverride === undefined ? character.systemPromptOverride : input.systemPromptOverride,
    persona,
    lorebook: input.lorebook ?? character.lorebook
  });

  const tags = input.tags === undefined ? undefined : normalizeCharacterTags(input.tags);
  const updated = await prisma.$transaction(async (transaction) => {
    const nextCharacter = await transaction.character.update({
      where: { id: characterId },
      data: {
        ...input,
        tags,
        avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl,
        communicationStyle: input.communicationStyle === undefined ? undefined : input.communicationStyle ?? Prisma.JsonNull,
        persona: input.name === undefined && input.persona === undefined ? undefined : persona ?? Prisma.JsonNull,
        lorebook: input.lorebook === undefined ? undefined : input.lorebook ?? Prisma.JsonNull,
        visualIdentity: input.visualIdentity === undefined ? undefined : input.visualIdentity ?? Prisma.JsonNull,
        moderationStatus: "APPROVED"
      }
    });
    if (tags) {
      await rememberUserTags(transaction, character.creatorId, tags);
    }
    return nextCharacter;
  });

  invalidateCharacterDiscovery();
  return updated;
}

export async function deleteCharacterForUser(characterId: string, user: Pick<CharacterMutationUser, "id" | "role">) {
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      ...(user.role === "ADMIN" ? {} : { creatorId: user.id })
    },
    select: { id: true }
  });

  if (!character) {
    throw new HttpError(404, "Character not found.");
  }

  await prisma.character.delete({ where: { id: characterId } });
  invalidateCharacterDiscovery();
}

export function invalidateCharacterDiscovery() {
  revalidateTag("public-character-feed");
}

function assertAgeGate(isNSFW: boolean, user: CharacterMutationUser) {
  if (isNSFW && !user.ageVerified) {
    throw new HttpError(403, "Confirm age-gated access in profile settings before marking characters as NSFW.");
  }
}

function assertPublicCharacterComplete(input: {
  visibility: string;
  avatarUrl?: string | null;
  scenario?: string | null;
  persona?: Prisma.JsonValue | null;
}) {
  if (input.visibility !== "PUBLIC") {
    return;
  }
  if (!input.avatarUrl?.trim()) {
    throw new HttpError(400, "Add an avatar before publishing a character publicly.");
  }
  if (!input.scenario?.trim()) {
    throw new HttpError(400, "Add a scenario before publishing a character publicly.");
  }
  if (!input.persona || (typeof input.persona === "object" && !Array.isArray(input.persona) && Object.keys(input.persona).length === 0)) {
    throw new HttpError(400, "Add persona details before publishing a character publicly.");
  }
}

function assertCharacterLanguageAllowed(input: {
  visibility: string;
  name: string;
  description: string;
  personality?: string | null;
  scenario?: string | null;
  greeting?: string | null;
  systemPromptOverride?: string | null;
  persona?: Prisma.JsonValue | null;
  lorebook?: Prisma.JsonValue | null;
}) {
  if (input.visibility === "PRIVATE") {
    return;
  }

  const authoredText = [
    input.name,
    input.description,
    input.personality,
    input.scenario,
    input.greeting,
    input.systemPromptOverride,
    JSON.stringify(input.persona ?? {}),
    JSON.stringify(input.lorebook ?? {})
  ]
    .filter(Boolean)
    .join("\n");

  if (containsRussianLanguage(authoredText)) {
    throw new HttpError(400, RUSSIAN_CHARACTER_PUBLICATION_ERROR);
  }
}

function assertCharacterModeration(input: {
  user: CharacterMutationUser;
  name: string;
  description: string;
  personality?: string | null;
  scenario?: string | null;
  greeting?: string | null;
  systemPromptOverride?: string | null;
  persona?: Prisma.JsonValue | null;
  lorebook?: Prisma.JsonValue | null;
}) {
  const moderation = moderateText({
    text: [
      input.name,
      input.description,
      input.personality,
      input.scenario,
      input.greeting,
      input.systemPromptOverride,
      JSON.stringify(input.persona ?? {}),
      JSON.stringify(input.lorebook ?? {})
    ]
      .filter(Boolean)
      .join("\n"),
    userIsMinor: isMinor(input.user.birthDate),
    context: "character"
  });

  if (!moderation.allowed) {
    throw new HttpError(400, moderation.reason ?? "Character content did not pass moderation.");
  }
}

function isMinor(birthDate: Date | null) {
  if (!birthDate) {
    return false;
  }
  return Date.now() - birthDate.getTime() < 18 * 365.25 * 24 * 60 * 60 * 1000;
}
