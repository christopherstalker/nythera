"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

type Chat = {
  id: string;
  title?: string | null;
  updatedAt: string;
  character: {
    name: string;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string }>;
};

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chats")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setChats(body.chats ?? []))
      .catch(() => setError("Sign in to view chats."));
  }, []);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={MessageSquare}
        title="Chats"
        description="Resume active character threads and memory-backed conversations."
        actions={
          <Button asChild>
            <Link href="/explore">
              <Plus className="h-4 w-4" />
              New chat
            </Link>
          </Button>
        }
      />

      {error ? (
        <EmptyState icon={MessageSquare} title="Sign in required" description={error} action={<Button asChild><Link href="/login">Sign in</Link></Button>} />
      ) : null}

      {!error && chats.length > 0 ? (
        <Surface className="overflow-hidden p-2">
          <div className="grid gap-2">
            {chats.map((chat, index) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-center gap-3 rounded-[24px] border border-transparent bg-white/[0.025] p-3 no-underline transition duration-200 hover:border-primary/25 hover:bg-primary/10"
              >
                <CharacterAvatar name={chat.character.name} avatarUrl={chat.character.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{chat.title || chat.character.name}</p>
                  <p className="mt-1 truncate text-[13px] leading-5 text-muted-foreground">{chat.messages[0]?.content || "No messages yet"}</p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs text-muted-foreground shadow-inset">
                  {index === 0 ? "now" : "saved"}
                </span>
              </Link>
            ))}
          </div>
        </Surface>
      ) : null}

      {!error && chats.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
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
      ) : null}
    </PageShell>
  );
}
