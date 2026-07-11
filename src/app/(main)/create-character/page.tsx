import { CharacterFormLoader } from "@/components/characters/character-form-loader";
import { PageHeader, PageShell } from "@/components/ui/page";
import { Plus } from "lucide-react";

export default function CreateCharacterPage() {
  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={Plus}
        title="Create character"
        description="Generate from one prompt with your API key, start simple, or open custom controls when you need them."
      />
      <CharacterFormLoader mode="create" />
    </PageShell>
  );
}
