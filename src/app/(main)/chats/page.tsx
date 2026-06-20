"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page";
import { toChatPreview } from "@/lib/chat-preview";

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
    fetch("/api/chats")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setChats(body.chats ?? []))
      .catch(() => setError("Sign in to view chats."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={MessageCircle}
        title="Chats"
        description="Resume recent character conversations."
        actions={
          <Button asChild>
            <Link href="/explore">
              <Plus className="h-4 w-4" />
              New chat
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-20" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={MessageCircle} title="Sign in required" description={error} action={<Button asChild><Link href="/login">Sign in</Link></Button>} />
      ) : chats.length > 0 ? (
        <div className="grid gap-3">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className="glass-card glass-card-hover flex items-center gap-3 p-4 no-underline active:scale-[0.99]"
            >
              <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{chat.title || chat.character.name}</p>
                <p className="mt-1 truncate text-[13px] leading-5 text-[var(--text-secondary)]">{toChatPreview(chat.messages[0]?.content || chat.character.description || "No messages yet")}</p>
              </div>
            </Link>
          ))}
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
