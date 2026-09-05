"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { toChatPreview } from "@/lib/chat-preview";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";

type Chat = {
  id: string;
  title?: string | null;
  updatedAt: string;
  lastActiveAt?: string;
  character: { name: string; description?: string | null; avatarUrl?: string | null };
  messages: Array<{ content: string }>;
};

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chats", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          response.status === 401 ? "Sign in to view chats." : "Your chats could not be loaded. Please try again."
        );
      const body = await response.json();
      setChats(body.chats ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "Sign in to view chats."
          ? caught.message
          : "Your chats could not be loaded. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const matchingChats = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return chats.filter((chat) =>
      [chat.title, chat.character.name, toChatPreview(chat.messages[0]?.content ?? "")].some((text) =>
        text?.toLowerCase().includes(needle)
      )
    );
  }, [chats, query]);
  const searching = Boolean(query.trim());
  const earlierChats = searching ? matchingChats : chats.slice(1);

  return (
    <PageShell className="codex-workspace codex-chats min-w-0 max-w-full space-y-6">
      <PageHeader
        compact
        icon={MessageCircle}
        title="Chats"
        description="Pick up a conversation or find a recent scene."
        actions={
          <Button asChild>
            <Link href="/explore">
              <Plus className="h-4 w-4" />
              New story
            </Link>
          </Button>
        }
      />
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search recent chats by character, title or last message…"
      />
      {loading ? (
        <div aria-label="Loading chats" role="status" className="grid gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={MessageCircle}
          title="Chats unavailable"
          description={error}
          action={
            error.startsWith("Sign in") ? (
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            ) : (
              <Button onClick={() => void loadChats()}>Try again</Button>
            )
          }
        />
      ) : !chats.length ? (
        <EmptyState
          icon={MessageCircle}
          title="No chats yet"
          description="Choose a character to start your first story."
          action={
            <Button asChild>
              <Link href="/explore">Explore characters</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {!searching ? (
            <Link
              href={`/chat/${chats[0].id}`}
              className="focus-ring group relative flex min-h-44 overflow-hidden rounded-2xl border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] no-underline"
            >
              <div className="relative hidden w-36 shrink-0 sm:block">
                <ChatHeroArtwork src={chats[0].character.avatarUrl} />
              </div>
              <div className="min-w-0 flex-1 p-5 sm:p-6">
                <p className="codex-kicker">Continue your latest scene</p>
                <h2 className="mt-3 font-editorial text-2xl text-[var(--text-primary)] sm:text-3xl">
                  {chats[0].title || chats[0].character.name}
                </h2>
                {chats[0].title ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">with {chats[0].character.name}</p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {toChatPreview(
                    chats[0].messages[0]?.content || chats[0].character.description || "The story is waiting."
                  )}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--codex-mint)]">
                  Continue conversation <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ) : null}
          <section aria-label={searching ? "Search results" : "Earlier conversations"}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{searching ? "Search results" : "Earlier conversations"}</h2>
              <p className="text-xs text-[var(--text-muted)]" role="status">
                {searching ? `${matchingChats.length} found` : `${chats.length} recent chats`}
              </p>
            </div>
            {searching && !earlierChats.length ? (
              <EmptyState
                icon={MessageCircle}
                title="No matching chats"
                description="Try a different name or a phrase from the last message."
                action={
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : null}
            <div className="divide-y divide-[var(--codex-rule)]">
              {earlierChats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="focus-ring group flex min-w-0 items-center gap-3 rounded-lg px-2 py-4 no-underline hover:bg-[var(--bg-elevated)] sm:gap-4"
                >
                  <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="sm" className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{chat.title || chat.character.name}</p>
                    {chat.title ? <p className="mt-1 text-xs text-[var(--codex-mint)]">{chat.character.name}</p> : null}
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                      {toChatPreview(chat.messages[0]?.content || "No messages yet")}
                    </p>
                    <time
                      dateTime={chat.lastActiveAt || chat.updatedAt}
                      className="mt-2 block text-xs text-[var(--text-muted)]"
                    >
                      {new Date(chat.lastActiveAt || chat.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric"
                      })}
                    </time>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}

function ChatHeroArtwork({ src }: { src?: string | null }) {
  if (!src) return <div className="absolute inset-0 bg-[var(--bg-elevated)]" />;
  if (shouldBypassNextImageOptimization(src))
    return <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  return <Image src={src} alt="" fill sizes="144px" className="object-cover" />;
}
