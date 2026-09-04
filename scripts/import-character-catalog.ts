import "dotenv/config";

import { readFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { FactoryCharacterSchema, CharacterBlueprintSchema, CharacterReviewSchema, CatalogSourceSchema } from "./character-factory/schema";
import { normalizeCharacterTags } from "../src/lib/character-tags";

const prisma = new PrismaClient();

type ImportRecord = {
  format: string;
  batchId: string;
  model: string;
  status: string;
  source: unknown;
  blueprint: unknown;
  character: unknown;
  review: unknown;
};

async function main() {
  const file = process.argv[2];
  const creatorEmail = process.argv[3];
  if (!file || !creatorEmail) {
    throw new Error("Usage: npm run characters:factory:import -- <factory.json> <creator-email>");
  }

  const creator = await prisma.user.findUnique({
    where: { email: creatorEmail },
    select: { id: true, ageVerified: true }
  });
  if (!creator) {
    throw new Error(`Creator not found for email: ${creatorEmail}`);
  }

  const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("Factory output must be a JSON array.");
  }

  let imported = 0;
  let skipped = 0;
  for (const candidate of raw as ImportRecord[]) {
    if (candidate.format !== "nythera-catalog-factory-v1" || candidate.status !== "READY_FOR_HUMAN_REVIEW") {
      skipped += 1;
      continue;
    }

    const source = CatalogSourceSchema.parse(candidate.source);
    const blueprint = CharacterBlueprintSchema.parse(candidate.blueprint);
    const character = FactoryCharacterSchema.parse(candidate.character);
    const review = CharacterReviewSchema.parse(candidate.review);
    if (source.isNSFW && !creator.ageVerified) {
      throw new Error(`Creator must be age-verified before importing NSFW draft: ${source.id}`);
    }

    const exists = await prisma.character.findFirst({
      where: {
        creatorId: creator.id,
        contentBatchId: candidate.batchId,
        sourceLabel: source.sourceLabel,
        name: character.name
      },
      select: { id: true }
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await prisma.character.create({
      data: {
        creatorId: creator.id,
        creationMode: "custom",
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        greeting: character.greeting,
        tags: normalizeCharacterTags([...character.tags, "ai-character"]),
        persona: { name: character.name, ...character.persona } as Prisma.InputJsonValue,
        communicationStyle: character.communicationStyle as Prisma.InputJsonValue,
        lorebook: character.lorebook as Prisma.InputJsonValue,
        originType: source.originType,
        sourceLabel: source.sourceLabel,
        sourceUrl: source.sourceUrls[0],
        isRealPerson: source.originType === "REAL_PERSON" || source.originType === "HISTORICAL_FIGURE",
        aiDisclosure: true,
        contentBatchId: candidate.batchId,
        qualityReport: {
          model: candidate.model,
          sourceId: source.id,
          sourceUrls: source.sourceUrls,
          blueprint,
          review
        } as Prisma.InputJsonValue,
        visibility: "PRIVATE",
        moderationStatus: "PENDING",
        isNSFW: source.isNSFW,
        avatarUrl: null
      }
    });
    imported += 1;
  }

  console.log(`Imported ${imported} private drafts; skipped ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
