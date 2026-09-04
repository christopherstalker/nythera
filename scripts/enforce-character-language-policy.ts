import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { containsRussianLanguage } from "../src/lib/language-policy";

const prisma = new PrismaClient();

async function main() {
  const published = await prisma.character.findMany({
    where: { visibility: { in: ["PUBLIC", "UNLISTED"] } },
    select: {
      id: true,
      name: true,
      description: true,
      personality: true,
      scenario: true,
      greeting: true,
      systemPromptOverride: true,
      persona: true,
      lorebook: true
    }
  });

  const disallowed = published.filter((character) =>
    containsRussianLanguage(
      [
        character.name,
        character.description,
        character.personality,
        character.scenario,
        character.greeting,
        character.systemPromptOverride,
        JSON.stringify(character.persona ?? {}),
        JSON.stringify(character.lorebook ?? {})
      ]
        .filter(Boolean)
        .join("\n")
    )
  );

  if (disallowed.length > 0) {
    await prisma.character.updateMany({
      where: { id: { in: disallowed.map((character) => character.id) } },
      data: { visibility: "PRIVATE", moderationStatus: "PENDING" }
    });
  }

  console.log(`Reviewed ${published.length} published characters; unpublished ${disallowed.length}.`);
  for (const character of disallowed) {
    console.log(`- ${character.id}: ${character.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
