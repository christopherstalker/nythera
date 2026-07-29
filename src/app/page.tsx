import type { Metadata } from "next";
import HomePageClient from "@/components/home/home-page-client";
import { auth } from "@/lib/auth";
import { getPublicCharacters, normalizePublicCharacterQuery } from "@/lib/discovery-feed";
import { getRecentChats } from "@/lib/recent-chats";

export const metadata: Metadata = {
  alternates: {
    canonical: "/"
  }
};

export default async function HomePage() {
  const session = await auth();
  const [characters, recentChats] = await Promise.all([
    getPublicCharacters(normalizePublicCharacterQuery({ take: 36, nsfw: "safe" })),
    session?.user?.id ? getRecentChats(session.user.id, 8) : Promise.resolve([])
  ]);

  return (
    <HomePageClient
      initialCharacters={characters}
      initialRecentChats={recentChats}
    />
  );
}
