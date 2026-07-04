"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, ChevronRight, MessageCircle, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { springSoft } from "@/lib/motion";

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
    async function loadLibrary() {
      try {
        const response = await fetch("/api/library", { cache: "no-store" });
        if (response.ok) {
          const body = await response.json();
          setLibrary(body);
          return;
        }

        throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "LIBRARY_UNAVAILABLE");
      } catch (caught) {
        setError(caught instanceof Error && caught.message === "AUTH_REQUIRED" ? "Sign in to view your library." : "Your library could not be loaded. Please try again.");
      }
    }

    void loadLibrary();
  }, []);

  return (
    <PageShell className="relative z-10 space-y-8 px-4 pb-24 pt-6 sm:px-6 md:pb-14 md:pt-8">
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="library-hero-panel relative isolate overflow-hidden p-5 sm:p-6 md:p-8"
      >
        <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="min-w-0">
            <span className="mb-5 grid h-11 w-11 place-items-center rounded-[var(--radius-control)] border border-[oklch(var(--color-accent-primary)/.34)] bg-[oklch(var(--color-accent-primary)/.12)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)]">
              <BookMarked className="h-5 w-5" />
            </span>
            <h1 className="text-heading-1 max-w-4xl font-semibold tracking-tight text-content-primary">Library</h1>
            <p className="text-body mt-2 max-w-2xl text-content-secondary sm:mt-3">
              Favorites, your characters, remixes, and active conversations.
            </p>
          </div>
          <Button asChild className="self-start bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft md:self-auto">
            <Link href="/create-character">
              <Plus className="h-4 w-4" />
              New character
            </Link>
          </Button>
        </div>
      </motion.header>

      {error ? (
        <EmptyState
          icon={BookMarked}
          title="Library unavailable"
          description={error}
          action={
            error === "Sign in to view your library." ? (
              <Button asChild><Link href="/login">Sign in</Link></Button>
            ) : (
              <Button onClick={() => window.location.reload()}>Try again</Button>
            )
          }
        />
      ) : !library ? (
        <div className="grid gap-4">
          <div className="skeleton h-32 rounded-[var(--radius-surface)]" />
          <div className="skeleton h-64 rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <>
          <Section title="Continue chats" empty="No active chats yet.">
            {library.chats.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {library.chats.map((chat, index) => (
                  <ChatRow key={chat.id} chat={chat} index={index} />
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Favorites" empty="Like characters to save them here.">
            {library.liked.length ? <CharacterShelf characters={library.liked} /> : null}
          </Section>

          <Section title="My characters" empty="Create a character to start building your roster.">
            {library.mine.length ? <CharacterShelf characters={library.mine} /> : null}
          </Section>

          <Section title="Remixes" empty="Cloned characters appear here.">
            {library.remixes.length ? <CharacterShelf characters={library.remixes} /> : null}
          </Section>
        </>
      )}
    </PageShell>
  );
}

function ChatRow({ chat, index }: { chat: LibraryBody["chats"][number]; index: number }) {
  const preview = chat.messages.at(-1)?.content || chat.character.description || "No description yet";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: Math.min(index, 6) * 0.035 }}
    >
      <Link href={`/chat/${chat.id}`} className="library-chat-row group flex items-center gap-3 p-3.5 no-underline sm:gap-4 sm:p-4">
        <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="md" className="border border-[var(--border-subtle)]" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)] sm:text-base">{chat.character.name}</p>
            {chat.title ? <span className="hidden truncate text-xs text-[var(--text-muted)] sm:inline">{chat.title}</span> : null}
          </div>
          <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--text-secondary)] sm:text-sm">{preview}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[oklch(var(--color-accent-primary)/.10)] text-[var(--accent-purple)] transition group-hover:border-[oklch(var(--color-accent-secondary)/.32)] group-hover:text-[var(--accent-secondary)]">
          <MessageCircle className="h-4 w-4" />
        </span>
      </Link>
    </motion.div>
  );
}

function CharacterShelf({ characters }: { characters: CharacterSummary[] }) {
  return (
    <div className="library-shelf chat-scroll">
      {characters.map((character) => (
        <CharacterCard key={character.id} character={character} presentation="discovery" fill />
      ))}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Boolean(children);
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={springSoft}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[oklch(var(--color-accent-primary)/.16)] text-[var(--accent-purple)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          {title}
        </h2>
        {hasChildren ? <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden /> : null}
      </div>
      {hasChildren ? children : <div className="library-empty-panel p-6 text-sm text-[var(--text-secondary)]">{empty}</div>}
    </motion.section>
  );
}
