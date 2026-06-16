import "dotenv/config";

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { toPrismaCharacterFields } from "../scripts/nythera-character-generator/schema";

const prisma = new PrismaClient();

type SeedCharacter = {
  id?: string;
  name: string;
  archetype?: string;
  emotional_hook?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  greeting?: string;
  tags?: string[];
  persona?: Record<string, unknown>;
  communicationStyle?: Record<string, unknown>;
};

async function main() {
  const file = process.argv[2] ?? "data/nythera-characters-sample.json";
  const creatorEmail = process.argv[3] ?? "chrisstalker@gmail.com";
  const visibility = (process.argv[4] ?? "PUBLIC").toUpperCase() as "PUBLIC" | "PRIVATE";

  const creator = await prisma.user.findUnique({ where: { email: creatorEmail } });
  if (!creator) {
    throw new Error(`Creator not found for email: ${creatorEmail}`);
  }

  const raw = await readFile(file, "utf8");
  const seeds = JSON.parse(raw) as SeedCharacter[];
  if (!Array.isArray(seeds) || seeds.length === 0) {
    throw new Error("Seed file must be a non-empty JSON array.");
  }

  let imported = 0;
  for (const seed of seeds) {
    const mapped = toPrismaCharacterFields(seed as Parameters<typeof toPrismaCharacterFields>[0]);
    const existing = seed.id
      ? await prisma.character.findFirst({ where: { creatorId: creator.id, name: mapped.name } })
      : null;

    if (existing) {
      continue;
    }

    await prisma.character.create({
      data: {
        creatorId: creator.id,
        name: mapped.name,
        description: mapped.description,
        personality: mapped.personality,
        scenario: mapped.scenario,
        greeting: mapped.greeting,
        tags: mapped.tags,
        persona: mapped.persona,
        communicationStyle: mapped.communicationStyle,
        visibility,
        moderationStatus: "APPROVED",
        avatarUrl: null
      }
    });
    imported += 1;
  }

  console.log(`Imported ${imported} characters for ${creatorEmail} from ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
