import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { PageShell } from "@/components/ui/page";
import { parseProfileSettings } from "@/lib/profile-settings";
import { prisma } from "@/lib/prisma";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-origin";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

export const revalidate = 300;

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getPublicProfile(username);
  if (!user?.username) {
    return { title: "Creator not found", robots: { index: false, follow: false } };
  }

  const title = `${user.username}'s AI roleplay characters`;
  const description = user.bio?.trim().slice(0, 160) || `Meet public AI roleplay characters created by ${user.username} on Nythera.`;
  const path = `/u/${encodeURIComponent(user.username)}`;
  const hasSafeCharacter = user.characters.some((character) => !character.isNSFW);

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: hasSafeCharacter ? undefined : { index: false, follow: true },
    openGraph: {
      type: "profile",
      url: path,
      title,
      description,
      images: user.avatarUrl ? [{ url: user.avatarUrl, alt: `${user.username}'s profile` }] : undefined
    },
    twitter: {
      card: user.avatarUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: user.avatarUrl ? [user.avatarUrl] : undefined
    }
  };
}

export default async function PublicUserProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const user = await getPublicProfile(username);

  if (!user?.username) notFound();

  const profileUrl = `${CANONICAL_SITE_ORIGIN}/u/${encodeURIComponent(user.username)}`;
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${profileUrl}#profile`,
    url: profileUrl,
    mainEntity: {
      "@type": "Person",
      "@id": `${profileUrl}#creator`,
      name: user.username,
      description: user.bio || undefined,
      image: user.avatarUrl || undefined,
      url: profileUrl
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c") }}
      />
      <PageShell className="max-w-6xl">
        <PublicProfileView
          username={user.username}
          bio={user.bio}
          avatarUrl={user.avatarUrl}
          accentColor={user.accentColor}
          settings={parseProfileSettings(user.profileSettings)}
          characters={user.characters}
        />
      </PageShell>
    </>
  );
}

const getPublicProfile = unstable_cache(
  async (username: string) => prisma.user.findFirst({
    where: { username, bannedAt: null },
    select: {
      username: true,
      bio: true,
      avatarUrl: true,
      accentColor: true,
      profileSettings: true,
      characters: {
        where: { visibility: "PUBLIC", moderationStatus: "APPROVED", blockedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: { id: true, name: true, avatarUrl: true, description: true, isNSFW: true }
      }
    }
  }),
  ["public-creator-profile-v1"],
  { revalidate, tags: ["public-character-feed"] }
);
