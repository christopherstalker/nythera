"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogIn, MessageCircle, Plus } from "lucide-react";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/page";

type ChatPreview = {
  id: string;
  title?: string | null;
  lastActiveAt?: string | null;
  updatedAt?: string | null;
  character?: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  } | null;
  messages: Array<{
    content: string;
  }>;
};

export function ContinueChatsPanel() {
  const { status } = useSession();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      setState("signed-out");
      setChats([]);
      return;
    }

    const controller = new AbortController();
    fetch("/api/chats", { signal: controller.signal })
      .then((response) => {
        if (response.status === 401) {
          setState("signed-out");
          return null;
        }

        if (!response.ok) {
          throw new Error("Could not load chats.");
        }

        return response.json();
      })
      .then((body) => {
        if (!body) {
          return;
        }

        setChats(Array.isArray(body.chats) ? body.chats.slice(0, 4) : []);
        setState("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setState("error");
        }
      });

    return () => controller.abort();
  }, [status]);

  return (
    <Surface className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Continue chatting</h2>
        <MessageCircle className="h-4 w-4 text-primary" />
      </div>

      <div className="mt-5 space-y-3">
        {state === "loading" ? (
          <>
            <div className="h-[72px] rounded-3xl skeleton" />
            <div className="h-[72px] rounded-3xl skeleton" />
          </>
        ) : null}

        {state === "signed-out" ? (
          <PanelEmpty
            icon={LogIn}
            title="Sign in to resume"
            description="Your recent chats appear here after you log in."
            action={
              <Button asChild size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            }
          />
        ) : null}

        {state === "error" ? <PanelEmpty icon={MessageCircle} title="Chats unavailable" description="Try again after signing in." /> : null}

        {state === "ready" && chats.length === 0 ? (
          <PanelEmpty
            icon={Plus}
            title="No chats yet"
            description="Create a character or open one from Explore to start a real thread."
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/create-character">Create character</Link>
              </Button>
            }
          />
        ) : null}

        {state === "ready"
          ? chats.map((chat) => {
              const characterName = chat.character?.name ?? "Character";
              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-start gap-3 rounded-3xl border border-white/[0.025] bg-white/[0.024] p-3.5 no-underline shadow-inset transition hover:-translate-y-0.5 hover:border-primary/[0.14] hover:bg-primary/[0.06]"
                >
                  <CharacterAvatar name={characterName} avatarUrl={chat.character?.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{chat.title || characterName}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{chat.character?.description || "No description yet"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatChatTime(chat.lastActiveAt ?? chat.updatedAt)}</span>
                </Link>
              );
            })
          : null}
      </div>
    </Surface>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: typeof MessageCircle;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.025] bg-white/[0.024] p-4 text-sm shadow-inset">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

function formatChatTime(value?: string | null) {
  if (!value) {
    return "saved";
  }

  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));

  if (diffMinutes < 2) {
    return "now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  if (diffMinutes < 24 * 60) {
    return `${Math.round(diffMinutes / 60)}h`;
  }

  return `${Math.round(diffMinutes / (24 * 60))}d`;
}
