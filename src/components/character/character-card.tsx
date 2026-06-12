"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, MessageCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { truncate } from "@/lib/utils";

type CharacterCardProps = {
  character: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    description: string;
    tags: string[];
    likes: number;
    ratingAverage?: number;
  };
};

const cardGradients = [
  "from-primary/[0.36] via-[#26203a] to-[#111019]",
  "from-[#f0a8c8]/[0.28] via-primary/[0.2] to-[#111019]",
  "from-[#8fd8c2]/25 via-[#272139] to-[#111019]",
  "from-primary/25 via-[#201a2f] to-[#111019]"
];

export function CharacterCard({ character }: CharacterCardProps) {
  const router = useRouter();
  const gradient = cardGradients[character.name.length % cardGradients.length];

  async function startChat() {
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
      router.push(`/character/${character.id}`);
      return;
    }

    const body = await response.json();
    router.push(`/chat/${body.chat.id}`);
  }

  return (
    <article className="group flex h-full min-h-[340px] flex-col overflow-hidden rounded-[32px] border border-white/[0.055] bg-card/[0.76] shadow-card-glow shadow-inset backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-primary/20 hover:bg-card/[0.9] hover:shadow-violet-hover">
      <Link href={`/character/${character.id}`} className="flex flex-1 flex-col no-underline">
        <div className={`relative h-32 bg-gradient-to-br ${gradient}`}>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_56%,rgba(0,0,0,0.18))]" />
          <CharacterAvatar
            name={character.name}
            avatarUrl={character.avatarUrl}
            size="lg"
            className="absolute -bottom-9 left-5 h-[76px] w-[76px] border-[3px] border-[#15111f] bg-[#15111f] text-2xl shadow-violet-hover"
          />
        </div>

        <div className="flex flex-1 flex-col p-5 pt-14">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">{character.name}</h3>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-foreground">
                  <Heart className="h-3.5 w-3.5 fill-[#f0a8c8] text-[#f0a8c8]" />
                  {character.likes}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary/20 text-primary" />
                  {(character.ratingAverage ?? 0).toFixed(1)}
                </span>
              </div>
            </div>
            {character.tags[0] ? <Badge className="border-primary/[0.16] bg-primary/[0.075] text-[#ddd6ff]">{character.tags[0]}</Badge> : null}
          </div>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{truncate(character.description, 180)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {character.tags.slice(0, 4).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/[0.045] p-4">
        <Button asChild variant="ghost">
          <Link href={`/character/${character.id}`}>
            Profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button type="button" variant="secondary" onClick={startChat}>
          <MessageCircle className="h-4 w-4" />
          Chat
        </Button>
      </div>
    </article>
  );
}
