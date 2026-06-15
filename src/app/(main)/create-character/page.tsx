import { CharacterForm } from "@/components/characters/character-form";
import { PageHeader, PageShell } from "@/components/ui/page";
import { Plus } from "lucide-react";

export default function CreateCharacterPage() {
  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={Plus}
        title="Create character"
        description="Start simple with a name and short description, or switch to custom controls when you need them."
      />
      <CharacterForm mode="create" />
    </PageShell>
  );
}
