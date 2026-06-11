"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="container py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[32px] font-bold leading-10 tracking-tight">Chats</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Resume active character threads and memory-backed conversations.</p>
        </div>
        <Button asChild>
          <Link href="/explore">
            <Plus className="h-4 w-4" />
            New Chat
          </Link>
        </Button>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        {chats.map((chat, index) => (
          <Link
            key={chat.id}
            href={`/chat/${chat.id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 no-underline shadow-card-glow transition duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/10"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/10 text-primary">
              {chat.character.avatarUrl ? (
                <img src={chat.character.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{chat.title || chat.character.name}</p>
              <p className="mt-1 truncate text-[13px] leading-5 text-muted-foreground">{chat.messages[0]?.content || "No messages yet"}</p>
            </div>
            <span className="text-xs text-muted-foreground">{index === 0 ? "now" : "saved"}</span>
          </Link>
        ))}
      </div>

      {!error && chats.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center shadow-card-glow">
          <MessageSquare className="mx-auto h-12 w-12 text-border" />
          <p className="mt-4 text-base text-muted-foreground">No chats yet.</p>
        </div>
      ) : null}
    </div>
  );
}
