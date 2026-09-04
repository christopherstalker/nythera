import { CharacterFormLoader } from "@/components/characters/character-form-loader";
import { PageShell } from "@/components/ui/page";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CreateCharacterPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { unlimitedCharacterFields: true }
      })
    : null;

  return (
    <PageShell className="codex-create-character !max-w-none !p-0">
      <CharacterFormLoader mode="create" unlimitedCharacterFields={user?.unlimitedCharacterFields === true} />
    </PageShell>
  );
}
