"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Flag, Heart, MessageCircle, Share2, Sparkles, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Character = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description: string;
  personality: string;
  scenario?: string | null;
  greeting: string;
  tags: string[];
  likes: number;
  visibility?: string;
  communicationStyle?: Record<string, unknown> | null;
  creator?: {
    username?: string | null;
  } | null;
};

export default function CharacterPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    fetch(`/api/characters/${params.id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setCharacter(body.character))
      .catch(() => setError("Character not found or unavailable."));
  }, [params.id]);

  const styleEntries = useMemo(() => {
    if (!character?.communicationStyle) {
      return [];
    }

    return Object.entries(character.communicationStyle)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .slice(0, 7);
  }, [character]);

  async function startChat() {
    if (!character) {
      return;
    }

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: character.id })
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not start chat.");
      return;
    }

    const body = await response.json();
    router.push(`/chat/${body.chat.id}`);
  }

  async function cloneCharacter() {
    const response = await fetch(`/api/characters/${params.id}`, { method: "POST" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (response.ok) {
      const body = await response.json();
      router.push(`/character/${body.character.id}`);
    }
  }

  async function likeCharacter() {
    const response = await fetch(`/api/characters/${params.id}/like`, { method: "POST" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (response.ok) {
      const body = await response.json();
      setLiked(Boolean(body.liked));
      setCharacter((current) =>
        current ? { ...current, likes: Math.max(0, current.likes + (body.liked ? 1 : -1)) } : current
      );
    }
  }

  if (error) {
    return <div className="container py-10 text-sm text-destructive">{error}</div>;
  }

  if (!character) {
    return (
      <div className="container py-10">
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <section className="app-panel overflow-hidden">
        <div className="hero-gradient px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="grid h-[120px] w-[120px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/10 shadow-violet-strong">
                {character.avatarUrl ? (
                  <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-character text-5xl font-bold text-primary">{character.name[0]}</span>
                )}
              </div>
              <div>
                <h1 className="max-w-3xl text-[32px] font-bold leading-10 tracking-tight text-white sm:text-[40px] sm:leading-[48px]">
                  {character.name}
                </h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#a0a0a0]">
                  <User className="h-4 w-4" />
                  by @{character.creator?.username ?? "velora"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {character.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={startChat} size="lg" className="px-7">
                <MessageCircle className="h-4 w-4" />
                Chat Now
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn("border-white/20 bg-white/5 text-white", liked && "border-destructive text-destructive")}
                onClick={likeCharacter}
              >
                <Heart className={cn("h-4 w-4 text-destructive", liked && "fill-destructive")} />
                Like
              </Button>
              <Button type="button" variant="outline" size="lg" className="border-white/20 bg-white/5 text-white">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-border bg-background/55 p-4 sm:grid-cols-3">
              <Stat icon={MessageCircle} value="Live" label="chat-ready" />
              <Stat icon={Heart} value={String(character.likes)} label="likes" red />
              <Stat icon={Star} value="4.8" label="rating" />
            </div>

            <Panel title="Personality">{character.personality}</Panel>
            <Panel title="Description">{character.description}</Panel>
            {character.scenario ? <Panel title="Scenario">{character.scenario}</Panel> : null}

            <div className="rounded-2xl border border-border bg-background/55 p-5">
              <h2 className="text-lg font-semibold leading-6">First Message</h2>
              <blockquote className="mt-4 border-l-[3px] border-primary bg-card px-4 py-3 text-sm leading-7 text-muted-foreground">
                {character.greeting}
              </blockquote>
            </div>
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border bg-background/55 p-5">
              <h2 className="text-lg font-semibold leading-6">Communication style</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {styleEntries.length > 0 ? (
                  styleEntries.map(([key, value]) => (
                    <span key={key} className="violet-pill">
                      {formatKey(key)}: {String(value)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No style settings yet.</span>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background/55 p-5">
              <h2 className="text-lg font-semibold leading-6">Creator actions</h2>
              <div className="mt-4 grid gap-2">
                <Button type="button" variant="outline" onClick={cloneCharacter}>
                  <Copy className="h-4 w-4" />
                  Clone character
                </Button>
                <Button type="button" variant="outline">
                  <Flag className="h-4 w-4 text-destructive" />
                  Report
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-primary/10 p-5">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Long-term memory can retrieve relevant user facts into the character prompt before replies.
              </p>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background/55 p-5">
      <h2 className="text-lg font-semibold leading-6">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-muted-foreground">{children}</p>
    </section>
  );
}

function Stat({ icon: Icon, value, label, red = false }: { icon: typeof MessageCircle; value: string; label: string; red?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn("h-5 w-5", red ? "text-destructive" : "text-primary")} />
      <div>
        <p className="font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
