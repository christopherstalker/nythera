"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { CharacterRow } from "@/components/characters/CharacterRow";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { sampleCharacters } from "@/components/characters/sampleCharacters";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page";

const fallbackCharacter: CharacterSummary = {
  id: "fallback",
  name: "Velora Guide",
  description: "A calm companion for getting started.",
  tags: ["friend"],
  creator: { username: "velora" }
};

export default function HomePage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/characters?take=36", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setCharacters(Array.isArray(body.characters) ? body.characters : []))
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const displayCharacters = characters.length > 0 ? characters : sampleCharacters;
  const featured = displayCharacters[0] ?? fallbackCharacter;
  const rows = useMemo(() => {
    const ranked = [...displayCharacters].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    return {
      featured: displayCharacters.slice(0, 10),
      trending: ranked.slice(0, 10),
      fresh: displayCharacters.slice(5, 15).length > 0 ? displayCharacters.slice(5, 15) : displayCharacters.slice(0, 10)
    };
  }, [displayCharacters]);

  async function startFeaturedChat() {
    if (featured.id === "fallback" || featured.id.startsWith("sample-")) {
      router.push("/create-character");
      return;
    }

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: featured.id })
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      router.push(`/character/${featured.id}`);
      return;
    }

    const body = await response.json();
    router.push(`/chat/${body.chat.id}`);
  }

  return (
    <PageShell className="space-y-8">
      <section className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-7 text-center shadow-[var(--shadow-card)]">
        <Avatar name={featured.name} src={featured.avatarUrl} size="xl" className="h-24 w-24 border border-[var(--border-default)]" />
        <h1 className="mt-4 max-w-2xl truncate text-2xl font-semibold text-[var(--text-primary)]">{featured.name}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
          {featured.description || "Start a new character chat and settle into the first scene."}
        </p>
        <Button type="button" onClick={startFeaturedChat} className="mt-5">
          <MessageCircle className="h-4 w-4" />
          Start Chat
        </Button>
      </section>

      <CharacterRow title="Featured For You" characters={rows.featured} loading={loading} />
      <CharacterRow title="Trending" characters={rows.trending} loading={loading} />
      <CharacterRow title="New" characters={rows.fresh} loading={loading} />
    </PageShell>
  );
}
