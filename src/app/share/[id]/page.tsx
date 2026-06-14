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
    fetch(`/api/shares/${params.id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setShare(body.share))
      .catch(() => setError("This shared chat is unavailable."));
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
    <PageShell className="space-y-6">
      <Surface className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={share.characterSnapshot.name} src={share.characterSnapshot.avatarUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-[var(--text-primary)]">{share.title || share.characterSnapshot.name}</h1>
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

      <Surface className="p-4">
        <div className="mx-auto flex max-w-[900px] flex-col gap-4">
          {share.messagesSnapshot.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "USER" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.role === "USER" ? "bubble-user" : "bubble-char"}>
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
