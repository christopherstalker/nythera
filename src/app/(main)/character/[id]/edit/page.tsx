"use client";

import { useEffect, useState } from "react";
import { Edit3 } from "lucide-react";
import { CharacterForm, type CharacterFormInitialValue } from "@/components/characters/character-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function EditCharacterPage({ params }: { params: { id: string } }) {
  const [character, setCharacter] = useState<CharacterFormInitialValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCharacter() {
      try {
        const response = await fetch(`/api/characters/${params.id}`, { cache: "no-store" });
        if (!response.ok) {
          setError("Character not found or unavailable.");
          return;
        }

        const body = await response.json();
        if (!body.viewer?.canEdit) {
          setError("You can edit only characters you created.");
          return;
        }

        setCharacter(body.character);
      } catch {
        setError("Character not found or unavailable.");
      }
    }

    void loadCharacter();
  }, [params.id]);

  if (error) {
    return (
      <PageShell>
        <EmptyState icon={Edit3} title="Cannot edit character" description={error} />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader icon={Edit3} title="Edit character" description="Update persona, lore, style tuning, and publishing settings." />
      {character ? <CharacterForm mode="edit" initialValue={character} /> : <div className="skeleton h-[620px]" />}
    </PageShell>
  );
}
