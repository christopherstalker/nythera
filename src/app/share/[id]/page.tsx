"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Surface } from "@/components/ui/page";

type SharedMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
};

type CharacterSnapshot = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
};

type Share = {
  id: string;
  title?: string | null;
  characterSnapshot: CharacterSnapshot;
  messagesSnapshot: SharedMessage[];
  createdAt: string;
};

export default function SharePage({ params }: { params: { id: string } }) {
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShare() {
      try {
        const response = await fetch(`/api/shares/${params.id}`, { cache: "no-store" });
        if (!response.ok) {
          setError("This shared chat is unavailable.");
          return;
        }

        const body = await response.json();
        setShare(body.share);
      } catch {
        setError("This shared chat is unavailable.");
      }
    }

    void loadShare();
  }, [params.id]);

  if (error) {
    return (
      <PageShell>
        <EmptyState icon={MessageCircle} title="Share unavailable" description={error} />
      </PageShell>
    );
  }

  if (!share) {
    return (
      <PageShell>
        <div className="skeleton h-[560px]" />
      </PageShell>
    );
  }

  return (
    <PageShell className="codex-share space-y-8">
      <Surface className="border-t-0 p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={share.characterSnapshot.name} src={share.characterSnapshot.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[.24em] text-[var(--codex-violet)]">Shared manuscript</p>
              <h1 className="font-editorial truncate text-4xl font-medium text-[var(--codex-ivory)]">{share.title || share.characterSnapshot.name}</h1>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{share.characterSnapshot.description}</p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/character/${share.characterSnapshot.id}`}>
              <MessageCircle className="h-4 w-4" />
              Start your chat
            </Link>
          </Button>
        </div>
      </Surface>

      <Surface className="p-5 md:p-10">
        <div className="mx-auto flex max-w-[760px] flex-col gap-8">
          {share.messagesSnapshot.map((message, index) => (
            <article key={`${message.role}-${index}`} className="border-b border-[var(--codex-rule)] pb-7">
              <p className={message.role === "USER" ? "mb-2 text-[10px] uppercase tracking-[.22em] text-[var(--codex-mint)]" : "mb-2 text-[10px] uppercase tracking-[.22em] text-[var(--codex-violet)]"}>{message.role === "USER" ? "You" : share.characterSnapshot.name}</p>
              <div className="font-editorial text-xl leading-8 text-[var(--codex-ivory)] md:text-2xl md:leading-9">
                {message.content}
              </div>
            </article>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
