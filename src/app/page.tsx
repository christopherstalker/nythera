"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, Plus, Search, Sparkles } from "lucide-react";
import { CharacterRow } from "@/components/characters/CharacterRow";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";

type RecentChat = {
  id: string;
  title?: string | null;
  character: {
    id: string;
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string; role?: string }>;
};

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHome() {
      setLoading(true);
      const [charactersResponse, chatsResponse] = await Promise.allSettled([
        fetch("/api/characters?take=36", { signal: controller.signal }),
        status === "authenticated" ? fetch("/api/chats", { cache: "no-store", signal: controller.signal }) : Promise.resolve(null)
      ]);

      if (charactersResponse.status === "fulfilled" && charactersResponse.value.ok) {
        const body = await charactersResponse.value.json().catch(() => null);
        setCharacters(Array.isArray(body?.characters) ? body.characters : []);
      } else {
        setCharacters([]);
      }

      if (chatsResponse.status === "fulfilled" && chatsResponse.value?.ok) {
        const body = await chatsResponse.value.json().catch(() => null);
        setRecentChats(Array.isArray(body?.chats) ? body.chats.slice(0, 8) : []);
      } else {
        setRecentChats([]);
      }

      setLoading(false);
    }

    void loadHome().catch(() => {
      if (!controller.signal.aborted) {
        setCharacters([]);
        setRecentChats([]);
        setLoading(false);
      }
    });

    return () => controller.abort();
  }, [status]);

  const featured = characters[0];
  const rows = useMemo(() => {
    const ranked = [...characters].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    return {
      featured: characters.slice(0, 10),
      trending: ranked.slice(0, 10),
      fresh: characters.slice(5, 15).length > 0 ? characters.slice(5, 15) : characters.slice(0, 10)
    };
  }, [characters]);

  const recentHero = recentChats[0];

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
      </PageShell>
    );
  }

  if (!featured && recentHero) {
    return (
      <PageShell className="space-y-8">
        <section className="app-surface relative isolate min-h-[360px] overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
          {recentHero.character.avatarUrl ? (
            <img
              src={recentHero.character.avatarUrl}
              alt=""
              className="pointer-events-none absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-85" />
          <div className="grid min-h-[300px] gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--glass-highlight)] backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
                Continue your story
              </div>
              <h1 className="text-display mt-5 font-semibold tracking-tight text-[var(--text-primary)]">
                {recentHero.character.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
                {recentHero.character.description || "Return to your latest real character chat and keep the scene moving."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/chat/${recentHero.id}`}>
                    <MessageCircle className="h-4 w-4" />
                    Continue chat
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/create-character">
                    <Plus className="h-4 w-4" />
                    Create character
                  </Link>
                </Button>
              </div>
            </div>
            <RecentChatCard chat={recentHero} featured />
          </div>
        </section>

        <section className="app-surface px-6 py-7 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">No public characters yet</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Only characters created by users are shown here. Create a character to start building Nythera.
          </p>
        </section>
      </PageShell>
    );
  }

  if (!featured) {
    return (
      <PageShell>
        <EmptyState
          icon={Search}
          title="No public characters yet"
          description="Only characters created by users are shown here. Create a character to start building Nythera."
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
          <img src={featured.avatarUrl} alt="" className="pointer-events-none absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-20 blur-2xl" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-90" />
        <div className="flex min-h-[270px] flex-col items-start justify-end text-left">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">Featured character</p>
          <h1 className="text-display mt-3 max-w-3xl font-semibold tracking-tight text-[var(--text-primary)]">
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

      <CharacterRow title="Featured For You" characters={rows.featured} />
      <CharacterRow title="Trending" characters={rows.trending} />
      <CharacterRow title="New" characters={rows.fresh} />
    </PageShell>
  );
}

function RecentChatCard({ chat, featured = false }: { chat: RecentChat; featured?: boolean }) {
  return (
    <Link href={`/chat/${chat.id}`} className="nythera-row-card group glass-card glass-card-hover relative flex h-[var(--card-height)] shrink-0 overflow-hidden no-underline active:scale-[0.98]">
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
        {chat.character.avatarUrl ? (
          <img src={chat.character.avatarUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgb(var(--accent-rgb)_/_0.24),rgb(20_20_35))] text-6xl font-semibold text-[var(--accent-purple)]">
            {chat.character.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/8 to-[#0b0b12]/80" />
      </div>
      <div className="absolute inset-x-0 bottom-0 min-h-[112px] bg-[linear-gradient(180deg,rgb(11_11_18_/_0.22),rgb(11_11_18_/_0.94)_34%,rgb(11_11_18_/_0.98))] px-4 pb-4 pt-5">
        <p className="truncate text-base font-semibold leading-6 tracking-tight text-white">{chat.character.name}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{featured ? "Latest chat" : "Continue chat"}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
          {chat.character.description || chat.messages[0]?.content || "Return to this character."}
        </p>
      </div>
    </Link>
  );
}
