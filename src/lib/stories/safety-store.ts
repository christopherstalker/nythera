import "server-only";

import { StoryContentRating } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export type StorySafetyInput = {
  contentRating: StoryContentRating;
  hardLimits: string[];
  softLimits: string[];
  fadeToBlack: string[];
  checkInInterval: number;
  paused: boolean;
  notes?: string | null;
};

export async function getStorySafety(storyId: string, userId: string) {
  await assertOwnedStory(storyId, userId);
  return prisma.storySafetyProfile.findUnique({ where: { storyId } });
}

export async function upsertStorySafety(storyId: string, userId: string, input: StorySafetyInput) {
  await assertOwnedStory(storyId, userId);
  const data = {
    contentRating: input.contentRating,
    hardLimits: input.hardLimits,
    softLimits: input.softLimits,
    fadeToBlack: input.fadeToBlack,
    checkInInterval: input.checkInInterval,
    paused: input.paused,
    notes: input.notes
  };
  return prisma.storySafetyProfile.upsert({
    where: { storyId },
    create: { storyId, ...data },
    update: data
  });
}

async function assertOwnedStory(storyId: string, userId: string) {
  const story = await prisma.story.findFirst({ where: { id: storyId, ownerId: userId }, select: { id: true } });
  if (!story) {
    throw new HttpError(404, "Story not found.");
  }
}
