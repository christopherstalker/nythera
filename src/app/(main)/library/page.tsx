"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, MessageCircle, Plus } from "lucide-react";
import { CharacterGrid } from "@/components/characters/CharacterGrid";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

type LibraryBody = {
  mine: CharacterSummary[];
  liked: CharacterSummary[];
  remixes: CharacterSummary[];
  chats: Array<{
    id: string;
    title?: string | null;
    character: { id: string; name: string; description?: string | null; avatarUrl?: string | null };
    messages: Array<{ content: string; role: string }>;
  }>;
};

export default function LibraryPage() {
  const [library, setLibrary] = useState<LibraryBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/library", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setLibrary(body))
      .catch(() => setError("Sign in to view your library."));
  }, []);

  return (
    <PageShell className="space-y-7">
      <PageHeader
        icon={BookMarked}
        title="Library"
        description="Favorites, your characters, remixes, and active conversations."
        actions={
          <Button asChild>
            <Link href="/create-character">
              <Plus className="h-4 w-4" />
              New character
            </Link>
          </Button>
        }
      />

      {error ? (
        <EmptyState icon={BookMarked} title="Library unavailable" description={error} action={<Button asChild><Link href="/login">Sign in</Link></Button>} />
      ) : !library ? (
        <div className="grid gap-4">
          <div className="skeleton h-32" />
          <div className="skeleton h-64" />
        </div>
      ) : (
        <>
          <Section title="Continue chats" empty="No active chats yet.">
            {library.chats.length ? (
              <div className="grid gap-3">
                {library.chats.map((chat) => (
                  <Link key={chat.id} href={`/chat/${chat.id}`} className="glass-card glass-card-hover flex items-center gap-3 p-4 no-underline">
                    <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{chat.title || chat.character.name}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">{chat.character.description || "No description yet"}</p>
                    </div>
                    <MessageCircle className="h-4 w-4 text-[var(--accent-purple)]" />
                  </Link>
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Favorites" empty="Like characters to save them here.">
            {library.liked.length ? <CharacterGrid characters={library.liked} /> : null}
          </Section>

          <Section title="My characters" empty="Create a character to start building your roster.">
            {library.mine.length ? <CharacterGrid characters={library.mine} /> : null}
          </Section>

          <Section title="Remixes" empty="Cloned characters appear here.">
            {library.remixes.length ? <CharacterGrid characters={library.remixes} /> : null}
          </Section>
        </>
      )}
    </PageShell>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Boolean(children);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      {hasChildren ? children : <Surface className="p-6 text-sm text-[var(--text-secondary)]">{empty}</Surface>}
    </section>
  );
}
