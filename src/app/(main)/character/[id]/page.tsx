"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Flag, Heart, MessageCircle, Share2, Sparkles, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Surface, SurfaceMuted } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import type { CharacterPersona } from "@/types";

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
  persona?: CharacterPersona | null;
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
    return (
      <PageShell>
        <EmptyState icon={Flag} title="Character unavailable" description={error} />
      </PageShell>
    );
  }

  if (!character) {
    return (
      <PageShell>
        <div className="skeleton h-[520px] rounded-[30px]" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Surface className="overflow-hidden">
        <div className="relative isolate px-6 py-9 sm:px-9 sm:py-11">
          <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-90" />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <CharacterAvatar name={character.name} avatarUrl={character.avatarUrl} size="xl" className="h-32 w-32 border-2 border-white/[0.045] shadow-violet-hover" />
              <div className="min-w-0">
                <h1 className="max-w-3xl text-[2.3rem] font-semibold leading-tight tracking-tight text-white sm:text-[3.3rem]">
                  {character.name}
                </h1>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  by @{character.creator?.username ?? "velora"}
                </p>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{character.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {character.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={startChat} size="lg" className="px-7">
                <MessageCircle className="h-4 w-4" />
                Start chat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(liked && "border-[#f0a8c8]/40 bg-[#f0a8c8]/10 text-[#ffd5e5]")}
                onClick={likeCharacter}
              >
                <Heart className={cn("h-4 w-4 text-[#f0a8c8]", liked && "fill-[#f0a8c8]")} />
                Like
              </Button>
              <Button type="button" variant="outline" size="lg">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat icon={MessageCircle} value="Live" label="chat-ready" />
              <Stat icon={Heart} value={String(character.likes)} label="likes" rose />
              <Stat icon={Star} value="4.8" label="rating" />
            </div>

            <ProfileSection title="Personality">{character.personality}</ProfileSection>
            {character.persona ? (
              <ProfileSection title="Persona engine">
                {[
                  character.persona.role ? `Role: ${character.persona.role}` : null,
                  character.persona.emotionalTone ? `Emotional tone: ${character.persona.emotionalTone}` : null,
                  character.persona.relationshipStyle ? `Relationship: ${character.persona.relationshipStyle}` : null,
                  character.persona.speakingStyle ? `Speaking style: ${character.persona.speakingStyle}` : null
                ]
                  .filter(Boolean)
                  .join("\n")}
              </ProfileSection>
            ) : null}
            {character.scenario ? <ProfileSection title="Scenario">{character.scenario}</ProfileSection> : null}
            <ProfileSection title="Greeting">
              <span className="block rounded-[24px] bg-primary/[0.065] px-4 py-3 text-foreground/90 shadow-inset">{character.greeting}</span>
            </ProfileSection>
            <ProfileSection title="Memory and lore">
              {character.scenario ? "This persona is configured with a scene foundation and can retrieve relevant saved memories during chat." : "No extra lore notes are available yet."}
            </ProfileSection>
          </main>

          <aside className="space-y-5">
            <SurfaceMuted className="p-5">
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
            </SurfaceMuted>

            <SurfaceMuted className="p-5">
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
            </SurfaceMuted>

            <SurfaceMuted className="p-5">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Long-term memory can retrieve relevant user facts into the character prompt before replies.
              </p>
            </SurfaceMuted>
          </aside>
        </div>
      </Surface>
    </PageShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SurfaceMuted className="p-6">
      <h2 className="text-lg font-semibold leading-6">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-muted-foreground">{children}</p>
    </SurfaceMuted>
  );
}

function Stat({ icon: Icon, value, label, rose = false }: { icon: typeof MessageCircle; value: string; label: string; rose?: boolean }) {
  return (
    <SurfaceMuted className="flex items-center gap-3 p-4">
      <Icon className={cn("h-5 w-5", rose ? "text-[#f0a8c8]" : "text-primary")} />
      <div>
        <p className="font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </SurfaceMuted>
  );
}

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
