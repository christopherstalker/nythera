import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import type { ZodType } from "zod";
import { blueprintPrompt, draftPrompt, reviewPrompt, revisionPrompt } from "./character-factory/prompts";
import {
  CharacterBlueprintSchema,
  CharacterReviewSchema,
  FactoryCharacterSchema,
  parseSourceManifest,
  recordStatus,
  type CatalogSource,
  type FactoryRecord
} from "./character-factory/schema";

type Args = {
  input: string;
  out: string;
  batchId: string;
  model: string;
  limit?: number;
  revise: boolean;
};

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const name = token.slice(2);
    const following = argv[index + 1];
    if (!following || following.startsWith("--")) {
      values.set(name, true);
      continue;
    }
    values.set(name, following);
    index += 1;
  }

  const batchId = String(values.get("batch") ?? new Date().toISOString().slice(0, 10).replaceAll("-", ""));
  const input = path.resolve(String(values.get("input") ?? "data/character-sources.json"));
  const out = path.resolve(
    String(values.get("out") ?? path.join("data", "character-factory", `${batchId}.json`))
  );
  const model = String(values.get("model") ?? process.env.CATALOG_FACTORY_MODEL ?? "gpt-4o-mini");
  const rawLimit = values.get("limit");
  const limit = typeof rawLimit === "string" ? Number(rawLimit) : undefined;

  if (!/^[a-z0-9][a-z0-9-_]{2,79}$/i.test(batchId)) {
    throw new Error("--batch must contain 3-80 letters, numbers, hyphens, or underscores.");
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
    throw new Error("--limit must be an integer between 1 and 1000.");
  }

  return { input, out, batchId, model, limit, revise: values.get("skip-revision") !== true };
}

async function completeJson<T>(
  client: OpenAI,
  model: string,
  prompt: { system: string; user: string },
  schema: ZodType<T>,
  temperature: number
) {
  const completion = await client.chat.completions.create({
    model,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ]
  });
  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("The model returned an empty response.");
  }
  return schema.parse(JSON.parse(content));
}

async function generateRecord(client: OpenAI, source: CatalogSource, args: Args): Promise<FactoryRecord> {
  const blueprint = await completeJson(
    client,
    args.model,
    blueprintPrompt(source),
    CharacterBlueprintSchema,
    0.35
  );
  let character = await completeJson(
    client,
    args.model,
    draftPrompt(source, blueprint),
    FactoryCharacterSchema,
    0.8
  );
  let review = await completeJson(
    client,
    args.model,
    reviewPrompt(source, blueprint, character),
    CharacterReviewSchema,
    0.15
  );

  if (args.revise && recordStatus(review) !== "READY_FOR_HUMAN_REVIEW" && review.verdict !== "REJECT") {
    character = await completeJson(
      client,
      args.model,
      revisionPrompt(source, blueprint, character, review),
      FactoryCharacterSchema,
      0.45
    );
    review = await completeJson(
      client,
      args.model,
      reviewPrompt(source, blueprint, character),
      CharacterReviewSchema,
      0.1
    );
  }

  return {
    format: "nythera-catalog-factory-v1",
    batchId: args.batchId,
    generatedAt: new Date().toISOString(),
    model: args.model,
    source,
    blueprint,
    character,
    review,
    status: recordStatus(review)
  };
}

async function readExisting(file: string) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as FactoryRecord[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persist(file: string, records: FactoryRecord[]) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required. Keep it in the environment or an ignored .env file.");
  }

  const args = parseArgs(process.argv.slice(2));
  const sources = parseSourceManifest(JSON.parse(await readFile(args.input, "utf8"))).slice(0, args.limit);
  const records = await readExisting(args.out);
  const completedIds = new Set(records.map((record) => record.source.id));
  const pending = sources.filter((source) => !completedIds.has(source.id));
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`Catalog factory: ${pending.length} pending, ${records.length} already complete.`);
  for (const [index, source] of pending.entries()) {
    console.log(`[${index + 1}/${pending.length}] ${source.name}`);
    const record = await generateRecord(client, source, args);
    records.push(record);
    await persist(args.out, records);
    console.log(`  ${record.status}`);
  }

  const summary = records.reduce<Record<string, number>>((totals, record) => {
    totals[record.status] = (totals[record.status] ?? 0) + 1;
    return totals;
  }, {});
  console.log(`Wrote ${records.length} records to ${args.out}`);
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
