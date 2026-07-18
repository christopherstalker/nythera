"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Map, MessageCircle, Route } from "lucide-react";
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
  storySnapshot?: {
    story: { title: string; mode: string };
    timeline?: { label: string; worldState?: Record<string, unknown> | null } | null;
    canon: Array<{ subject?: string | null; predicate: string; objectText: string; locked: boolean }>;
    narrative: { arcs: Array<{ title: string; premise: string; progress: number }> };
    cast: Array<{ displayName: string; role: string }>;
  } | null;
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
              <h1 className="font-editorial line-clamp-2 text-3xl font-medium leading-tight text-[var(--codex-ivory)] sm:text-4xl">{share.title || share.characterSnapshot.name}</h1>
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

      {share.storySnapshot ? (
        <Surface className="p-5 md:p-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <SharedStorySection icon={Map} label="Scene">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{share.storySnapshot.timeline?.label ?? "Shared timeline"}</p>
              {share.storySnapshot.timeline?.worldState ? <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--text-muted)]">{JSON.stringify(share.storySnapshot.timeline.worldState, null, 2)}</pre> : null}
            </SharedStorySection>
            <SharedStorySection icon={Route} label="Active arcs">
              {share.storySnapshot.narrative.arcs.slice(0, 4).map((arc) => <div key={arc.title} className="border-b border-[var(--codex-rule)] py-2 last:border-0"><p className="text-sm text-[var(--codex-ivory)]">{arc.title} · {arc.progress}%</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{arc.premise}</p></div>)}
              {share.storySnapshot.narrative.arcs.length === 0 ? <p className="text-sm text-[var(--text-muted)]">The story is following the scene.</p> : null}
            </SharedStorySection>
            <SharedStorySection icon={BookOpen} label="Public canon">
              {share.storySnapshot.canon.slice(0, 6).map((fact, index) => <p key={`${fact.predicate}-${index}`} className="border-b border-[var(--codex-rule)] py-2 text-xs leading-5 text-[var(--text-secondary)] last:border-0">{fact.subject ? `${fact.subject} ` : ""}{fact.predicate}: {fact.objectText}{fact.locked ? " · locked" : ""}</p>)}
              {share.storySnapshot.canon.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No public canon was included.</p> : null}
            </SharedStorySection>
          </div>
        </Surface>
      ) : null}

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

function SharedStorySection({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return <section className="min-w-0"><div className="mb-3 flex items-center gap-2 text-[var(--codex-mint)]"><Icon className="h-4 w-4" /><h2 className="text-[10px] uppercase tracking-[.22em]">{label}</h2></div>{children}</section>;
}
