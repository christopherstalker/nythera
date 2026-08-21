"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Plus, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page";
import { toChatPreview } from "@/lib/chat-preview";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";

type Chat = {
  id: string;
  title?: string | null;
  updatedAt: string;
  character: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string }>;
};

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChats() {
      try {
        const response = await fetch("/api/chats");
        if (!response.ok) {
          setError("Sign in to view chats.");
          return;
        }

        const body = await response.json();
        setChats(body.chats ?? []);
      } catch {
        setError("Sign in to view chats.");
      } finally {
        setLoading(false);
      }
    }

    void loadChats();
  }, []);

  return (
    <PageShell className="codex-chats min-w-0 max-w-full space-y-12">
      <PageHeader icon={Sparkles} title="Chats" description="Return to a scene exactly where the story left you." actions={<Button asChild><Link href="/explore"><Plus className="h-4 w-4" />New story</Link></Button>} />

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-20" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={MessageCircle} title="Sign in required" description={error} action={<Button asChild><Link href="/login">Sign in</Link></Button>} />
      ) : chats.length > 0 ? (
        <div className="grid w-full min-w-0 max-w-full gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <Link href={`/chat/${chats[0].id}`} className="group relative min-h-[430px] min-w-0 max-w-full overflow-hidden border-y border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] no-underline sm:min-h-[540px]">
            <ChatHeroArtwork src={chats[0].character.avatarUrl} />
            <div className="absolute inset-0 bg-[color:oklch(var(--color-canvas)/.76)]" />
            <div className="glass-grain pointer-events-none absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--accent-secondary)]">Continue your latest scene</p>
              <div className="flex items-end gap-4"><div className="min-w-0 flex-1"><h2 className="font-editorial truncate text-5xl font-medium tracking-tight text-[var(--codex-ivory)] sm:text-6xl">{chats[0].character.name}</h2><p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{toChatPreview(chats[0].messages[0]?.content || chats[0].character.description || "The story is waiting.")}</p></div><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--codex-mint)] text-[var(--codex-mint)]"><ArrowUpRight className="h-5 w-5" /></span></div>
            </div>
          </Link>
          <section aria-label="Earlier conversations" className="min-w-0 max-w-full overflow-hidden">
            <div className="mb-4 flex items-center gap-3"><h2 className="text-lg font-semibold text-[var(--text-primary)]">Earlier conversations</h2><span className="h-px flex-1 bg-white/[.08]" /></div>
            <div className="min-w-0 max-w-full divide-y divide-white/[.08]">
              {chats.slice(1).map((chat) => (
                <Link key={chat.id} href={`/chat/${chat.id}`} className="group grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 no-underline sm:gap-4">
                  <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="sm" className="h-14 w-14 rounded-[18px]" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">{chat.character.name}</p><p className="mt-1 truncate text-[13px] leading-5 text-[var(--text-secondary)]">{toChatPreview(chat.messages[0]?.content || chat.character.description || "No messages yet")}</p></div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              ))}
              {chats.length === 1 ? <p className="py-8 text-sm leading-6 text-[var(--text-muted)]">Your next story will appear here.</p> : null}
            </div>
          </section>
        </div>
      ) : (
        <EmptyState
          icon={MessageCircle}
          title="No chats yet"
          description="Explore public characters or create your own to begin a conversation."
          action={
            <Button asChild>
              <Link href="/explore">
                <Plus className="h-4 w-4" />
                Explore characters
              </Link>
            </Button>
          }
        />
      )}
    </PageShell>
  );
}

function ChatHeroArtwork({ src }: { src?: string | null }) {
  if (!src) {
    return <div className="absolute inset-0 bg-[var(--bg-elevated)]" />;
  }

  if (shouldBypassNextImageOptimization(src)) {
    return <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-38" />;
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(min-width: 1280px) 52vw, 100vw"
      className="absolute inset-0 h-full w-full object-cover opacity-38"
    />
  );
}
