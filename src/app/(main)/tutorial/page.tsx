import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TutorialExperience } from "@/components/tutorial/tutorial-experience";
import { auth } from "@/lib/auth";
import { loginUrl, normalizeCallbackPath } from "@/lib/auth-routes";
import { prisma } from "@/lib/prisma";
import { getPublicCharacterProfile } from "@/lib/public-character-profile";
import { getServerProviderKeys } from "@/lib/user-keys";
import { clampTutorialStep, parseTutorialState, TUTORIAL_CHARACTER_ID } from "@/lib/tutorial";

export const metadata: Metadata = {
  title: "Interactive tutorial",
  description: "Learn Nythera through a short playable story."
};

type TutorialPageProps = {
  searchParams: Promise<{ callbackUrl?: string; replay?: string }>;
};

export default async function TutorialPage({ searchParams }: TutorialPageProps) {
  const params = await searchParams;
  const callbackPath = normalizeCallbackPath(params.callbackUrl, "/explore");
  const session = await auth();

  if (!session?.user?.id) {
    const returnPath = `/tutorial?callbackUrl=${encodeURIComponent(callbackPath)}`;
    redirect(loginUrl(returnPath));
  }

  const [character, user, providerKey] = await Promise.all([
    getPublicCharacterProfile(TUTORIAL_CHARACTER_ID),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        tutorialStatus: true,
        tutorialStep: true,
        tutorialState: true
      }
    }),
    prisma.userApiKey.findFirst({
      where: {
        userId: session.user.id,
        credentialStatus: { not: "INVALID" }
      },
      select: { id: true }
    })
  ]);

  const hasProvider = Boolean(providerKey) || getServerProviderKeys().length > 0;
  const withProviderSetup = (destination: string) => hasProvider
    ? destination
    : `/settings/providers?onboarding=1&callbackUrl=${encodeURIComponent(destination)}`;

  if (!character || !user) {
    redirect(withProviderSetup(callbackPath));
  }

  const replaying = params.replay === "1";

  return (
    <TutorialExperience
      character={{
        id: character.id,
        name: character.name,
        avatarUrl: character.avatarUrl ?? null,
        description: character.description,
        creatorName: character.creator?.username ?? "Christopher"
      }}
      travelerName={user.username ?? session.user.name ?? "Traveler"}
      initialStep={replaying ? 0 : clampTutorialStep(user.tutorialStep)}
      initialState={replaying ? {} : parseTutorialState(user.tutorialState)}
      continueHref={withProviderSetup(`/character/${character.id}`)}
      exitHref={withProviderSetup(callbackPath)}
    />
  );
}
