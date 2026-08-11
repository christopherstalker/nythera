import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { PublicCharacterProfile } from "@/types";

export const getPublicCharacterProfile = cache(async (id: string): Promise<PublicCharacterProfile | null> => {
  const character = await prisma.character.findFirst({
    where: {
      id,
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      blockedAt: null
    },
    select: {
      id: true,
      creatorId: true,
      name: true,
      avatarUrl: true,
      description: true,
      personality: true,
      scenario: true,
      greeting: true,
      tags: true,
      likes: true,
      ratingAverage: true,
      ratingCount: true,
      isNSFW: true,
      visibility: true,
      communicationStyle: true,
      persona: true,
      lorebook: true,
      visualIdentity: true,
      creator: {
        select: {
          username: true
        }
      }
    }
  });

  return character as PublicCharacterProfile | null;
});

export const getCharacterProfileForViewer = cache(async (id: string, viewerId?: string): Promise<PublicCharacterProfile | null> => {
  const character = await prisma.character.findFirst({
    where: {
      id,
      blockedAt: null,
      OR: [
        { visibility: "PUBLIC", moderationStatus: "APPROVED" },
        { visibility: "UNLISTED", moderationStatus: "APPROVED" },
        ...(viewerId ? [{ creatorId: viewerId }] : [])
      ]
    },
    select: {
      id: true,
      creatorId: true,
      name: true,
      avatarUrl: true,
      description: true,
      personality: true,
      scenario: true,
      greeting: true,
      tags: true,
      likes: true,
      ratingAverage: true,
      ratingCount: true,
      isNSFW: true,
      visibility: true,
      communicationStyle: true,
      persona: true,
      lorebook: true,
      visualIdentity: true,
      creator: {
        select: {
          username: true
        }
      }
    }
  });

  return character as PublicCharacterProfile | null;
});
