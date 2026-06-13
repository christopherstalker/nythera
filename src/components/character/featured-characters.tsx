"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type Character = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description: string;
  tags: string[];
  likes: number;
  ratingAverage?: number;
};

export function FeaturedCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/characters?take=4", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setCharacters(Array.isArray(body.characters) ? body.characters : []))
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-[340px] rounded-[32px] skeleton" />
        <div className="h-[340px] rounded-[32px] skeleton" />
        <div className="h-[340px] rounded-[32px] skeleton" />
        <div className="h-[340px] rounded-[32px] skeleton" />
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No characters yet"
        description="The public catalog is empty now. Create your first character and it will appear after moderation approval."
        action={
          <Button asChild>
            <Link href="/create-character">
              <Plus className="h-4 w-4" />
              Create character
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {characters.map((item) => (
        <CharacterCard key={item.id} character={item} />
      ))}
    </div>
  );
}
