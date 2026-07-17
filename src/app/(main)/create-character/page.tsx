import { CharacterFormLoader } from "@/components/characters/character-form-loader";
import { PageShell } from "@/components/ui/page";

export default function CreateCharacterPage() {
  return (
    <PageShell className="codex-create-character !max-w-none !p-0">
      <CharacterFormLoader mode="create" />
    </PageShell>
  );
}
