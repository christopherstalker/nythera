import type { Metadata } from "next";
import HomePageClient from "@/components/home/home-page-client";
import { getPublicCharacters, normalizePublicCharacterQuery } from "@/lib/discovery-feed";
import { loadServerData } from "@/lib/server-data";

export const metadata: Metadata = {
  alternates: {
    canonical: "/"
  }
};

export default async function HomePage() {
  let characters: Awaited<ReturnType<typeof getPublicCharacters>> = [];
  let isServiceUnavailable = false;

  try {
    characters = await loadServerData("Home discovery feed", () =>
      getPublicCharacters(normalizePublicCharacterQuery({ take: 36, nsfw: "safe" }))
    );
  } catch (error) {
    console.error("[home] Discovery feed unavailable", error);
    isServiceUnavailable = true;
  }

  return (
    <HomePageClient
      initialCharacters={characters}
      initialRecentChats={[]}
      isServiceUnavailable={isServiceUnavailable}
    />
  );
}
