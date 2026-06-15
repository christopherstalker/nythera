"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus, Search } from "lucide-react";
import { CharacterRow } from "@/components/characters/CharacterRow";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";

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

  const featured = characters[0];
  const rows = useMemo(() => {
    const ranked = [...characters].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    return {
      featured: characters.slice(0, 10),
      trending: ranked.slice(0, 10),
      fresh: characters.slice(5, 15).length > 0 ? characters.slice(5, 15) : characters.slice(0, 10)
    };
  }, [characters]);

  async function startFeaturedChat() {
    if (!featured) {
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

  if (loading) {
    return (
      <PageShell className="space-y-8">
        <section className="app-surface flex min-h-[330px] w-full flex-col items-center justify-center px-6 py-8 text-center">
          <div className="skeleton h-24 w-24 rounded-full" />
          <div className="skeleton mt-5 h-7 w-48 max-w-full" />
          <div className="skeleton mt-3 h-4 w-full max-w-xl" />
          <div className="skeleton mt-2 h-4 w-80 max-w-full" />
          <div className="skeleton mt-5 h-10 w-32 rounded-[var(--radius-pill)]" />
        </section>

        <CharacterRow title="Featured For You" characters={[]} loading />
        <CharacterRow title="Trending" characters={[]} loading />
        <CharacterRow title="New" characters={[]} loading />
      </PageShell>
    );
  }

  if (!featured) {
    return (
      <PageShell>
        <EmptyState
          icon={Search}
          title="No public characters yet"
          description="Only characters created by real users are shown here. Create the first public character to start filling the catalog."
          action={
            <Button asChild>
              <Link href="/create-character">
                <Plus className="h-4 w-4" />
                Create character
              </Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-8">
      <section className="app-surface relative isolate min-h-[330px] overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
        {featured.avatarUrl ? (
          <img
            src={featured.avatarUrl}
            alt=""
            className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-20 blur-2xl scale-110"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-90" />
        <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
          <Avatar name={featured.name} src={featured.avatarUrl} size="xl" className="h-28 w-28 border border-white/15 shadow-[var(--shadow-glow)]" />
          <h1 className="mt-5 max-w-3xl truncate text-3xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
            {featured.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
            {featured.description || "Start a new character chat and settle into the first scene."}
          </p>
          <Button type="button" onClick={startFeaturedChat} className="mt-6">
            <MessageCircle className="h-4 w-4" />
            Start Chat
          </Button>
        </div>
      </section>

      <CharacterRow title="Featured For You" characters={rows.featured} loading={loading} />
      <CharacterRow title="Trending" characters={rows.trending} loading={loading} />
      <CharacterRow title="New" characters={rows.fresh} loading={loading} />
    </PageShell>
  );
}
