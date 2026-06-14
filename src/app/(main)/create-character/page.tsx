import { CharacterForm } from "@/components/characters/character-form";
import { PageHeader, PageShell } from "@/components/ui/page";
import { Plus } from "lucide-react";

export default function CreateCharacterPage() {
  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={Plus}
        title="Create character"
        description="Build a persona, greeting, lore, style tuning, and publishing settings."
      />
      <CharacterForm mode="create" />
    </PageShell>
  );
}
