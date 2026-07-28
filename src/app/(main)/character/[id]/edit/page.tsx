"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Edit3 } from "lucide-react";
import { CharacterFormLoader, CharacterFormSkeleton } from "@/components/characters/character-form-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import type { CharacterFormInitialValue } from "@/lib/character-form-types";

export default function EditCharacterPage() {
  const params = useParams<{ id: string }>();
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
    <PageShell className="codex-create-character !max-w-none !p-0">
      {character ? <CharacterFormLoader mode="edit" initialValue={character} /> : <CharacterFormSkeleton />}
    </PageShell>
  );
}
