"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Star } from "lucide-react";
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

export function CharacterCard({ character }: CharacterCardProps) {
  const router = useRouter();

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
    <article className="group flex h-full min-h-[306px] flex-col rounded-[30px] border border-white/[0.04] bg-card/[0.62] p-4 shadow-card-glow shadow-inset backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-primary/18 hover:bg-card/[0.84] hover:shadow-violet-hover">
      <Link href={`/character/${character.id}`} className="flex flex-1 flex-col items-center text-center no-underline">
        <div className="relative grid h-24 w-24 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl transition group-hover:bg-primary/18" />
          <CharacterAvatar
            name={character.name}
            avatarUrl={character.avatarUrl}
            size="xl"
            className="relative h-24 w-24 border-[3px] border-white/[0.06] bg-[#15111f] text-3xl shadow-violet-hover"
          />
        </div>

        <div className="flex flex-1 flex-col items-center pt-4">
          <h3 className="max-w-full truncate text-lg font-semibold tracking-tight text-foreground">{character.name}</h3>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-foreground">
              <Heart className="h-3.5 w-3.5 fill-[#d8b4fe] text-[#d8b4fe]" />
              {character.likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-primary/20 text-primary" />
              {(character.ratingAverage ?? 0).toFixed(1)}
            </span>
          </div>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{truncate(character.description, 150)}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {character.tags.slice(0, 3).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      </Link>

      <div className="mt-4 grid gap-2">
        <Button type="button" variant="secondary" className="w-full" onClick={startChat}>
          <MessageCircle className="h-4 w-4" />
          Chat
        </Button>
        <Button asChild variant="ghost" className="h-9 text-xs">
          <Link href={`/character/${character.id}`}>View profile</Link>
        </Button>
      </div>
    </article>
  );
}
