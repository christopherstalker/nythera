"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  "from-primary/85 via-primary/30 to-destructive/30",
  "from-destructive/70 via-primary/35 to-[#161616]",
  "from-primary/60 via-[#242036] to-[#161616]",
  "from-primary/75 via-primary/20 to-[#161616]"
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
    <article className="group flex h-full min-h-[300px] flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-card-glow transition duration-200 hover:-translate-y-1 hover:border-primary/45 hover:shadow-violet-hover">
      <Link href={`/character/${character.id}`} className="flex flex-1 flex-col no-underline">
        <div className={`relative h-24 bg-gradient-to-br ${gradient}`}>
          <div className="absolute -bottom-9 left-5 grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-[#161616] shadow-card-glow">
            {character.avatarUrl ? (
              <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-character text-2xl font-bold text-primary">{character.name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5 pt-11">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <h3 className="text-character truncate text-base font-semibold text-foreground">{character.name}</h3>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-foreground">
                <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />
                {character.likes}
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-primary" />
                {(character.ratingAverage ?? 0).toFixed(1)}
              </span>
            </div>
          </div>
            {character.tags[0] ? <Badge>{character.tags[0]}</Badge> : null}
        </div>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{truncate(character.description, 150)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
        {character.tags.slice(0, 4).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
        <Button asChild variant="outline">
          <Link href={`/character/${character.id}`}>Profile</Link>
        </Button>
        <Button type="button" variant="secondary" onClick={startChat}>
          <MessageCircle className="h-4 w-4" />
          Chat
        </Button>
      </div>
    </article>
  );
}
