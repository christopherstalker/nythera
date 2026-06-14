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
    <article className="group flex h-full min-h-[342px] flex-col rounded-[30px] border border-white/[0.025] bg-card/[0.56] p-5 shadow-card-glow shadow-inset backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-primary/[0.14] hover:bg-card/[0.74] hover:shadow-violet-hover">
      <Link href={`/character/${character.id}`} className="flex flex-1 flex-col items-center text-center no-underline">
        <div className="relative mt-1 grid h-28 w-28 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/[0.16]" />
          <CharacterAvatar
            name={character.name}
            avatarUrl={character.avatarUrl}
            size="xl"
            className="relative h-28 w-28 border-[3px] border-white/[0.045] bg-[#15111f] text-3xl shadow-violet-hover"
          />
        </div>

        <div className="flex flex-1 flex-col items-center pt-5">
          <h3 className="max-w-full truncate text-xl font-semibold tracking-tight text-foreground">{character.name}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">{truncate(character.description, 150)}</p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {character.tags.slice(0, 3).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      </Link>

      <div className="mt-5 grid gap-3">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 fill-[#d8b4fe] text-[#d8b4fe]" />
            {character.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary/20 text-primary" />
            {(character.ratingAverage ?? 0).toFixed(1)}
          </span>
        </div>
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
