import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  NytheraCharacterBatchSchema,
  NytheraCharacterSeedSchema,
  type NytheraCharacterSeed
} from "./nythera-character-generator/schema";
import { dedupeSeeds } from "./nythera-character-generator/dedupe";
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt } from "./nythera-character-generator/prompts";
import { embedTextOpenAI, generateJsonWithOpenAI } from "./nythera-character-generator/openai";

type Args = {
  count: number;
  out: string;
  model: string;
  chunk: number;
  temperature: number;
  batchId: string;
  useEmbeddings: boolean;
  genreMixHint?: string;
};

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]!;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, true);
      continue;
    }
    flags.set(key, next);
    i += 1;
  }

  const count = Number(flags.get("count") ?? 150);
  const chunk = Number(flags.get("chunk") ?? 20);
  const temperature = Number(flags.get("temperature") ?? 0.95);
  const model = String(flags.get("model") ?? "gpt-4o-mini");
  const batchId = String(flags.get("batch") ?? new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const out = String(flags.get("out") ?? path.join(process.cwd(), "data", `nythera-characters-${batchId}.json`));
  const useEmbeddings = flags.get("embeddings") === true || String(flags.get("embeddings") ?? "") === "true";
  const genreMixHint = typeof flags.get("genreMix") === "string" ? String(flags.get("genreMix")) : undefined;

  if (!Number.isFinite(count) || count < 100 || count > 200) {
    throw new Error("--count must be between 100 and 200.");
  }
  if (!Number.isFinite(chunk) || chunk < 8 || chunk > 30) {
    throw new Error("--chunk must be between 8 and 30 (token safety).");
  }
  if (!Number.isFinite(temperature) || temperature < 0.4 || temperature > 1.3) {
    throw new Error("--temperature must be between 0.4 and 1.3.");
  }

  return { count, out, model, chunk, temperature, batchId, useEmbeddings, genreMixHint };
}

function asArrayFromJsonObjectOnly(raw: string) {
  // We request json_object response_format; allow either:
  // { "characters": [ ... ] } OR [ ... ] (some models still do this).
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).characters)) return (parsed as any).characters;
  return parsed;
}

function oneSentence(value: string) {
  const trimmed = value.trim();
  const sentenceMarks = trimmed.match(/[.!?](?=\s|$)/g)?.length ?? 0;
  return sentenceMarks <= 1;
}

function validateSeedTight(seed: NytheraCharacterSeed) {
  // Additional “cinematic + viral” constraints beyond Zod.
  if (!oneSentence(seed.emotional_hook)) throw new Error(`emotional_hook must be exactly one sentence (${seed.id}).`);
  const greetSentences = seed.greeting.match(/[.!?](?=\s|$)/g)?.length ?? 0;
  if (greetSentences < 4) throw new Error(`Greeting too short (${seed.id}).`);
  if (seed.conversation_hooks.length < 4) throw new Error(`conversation_hooks too short (${seed.id}).`);
}

function schemaHint() {
  // small enough to re-inject into repair prompt
  return NytheraCharacterSeedSchema.describe("NytheraCharacterSeed").toString();
}

async function generateChunk(params: {
  model: string;
  temperature: number;
  count: number;
  batchId: string;
  startIndex: number;
  avoidNames: string[];
  avoidArchetypes: string[];
  avoidPhrases: string[];
  genreMixHint?: string;
  recentSeeds: Array<Pick<NytheraCharacterSeed, "id" | "name" | "archetype" | "emotional_hook">>;
}) {
  const system = buildSystemPrompt();
  const user = buildUserPrompt({
    count: params.count,
    batchId: params.batchId,
    genreMixHint: params.genreMixHint,
    avoidNames: params.avoidNames,
    avoidArchetypes: params.avoidArchetypes,
    avoidPhrases: params.avoidPhrases,
    recentSeeds: params.recentSeeds
  });

  const raw = await generateJsonWithOpenAI({
    model: params.model,
    temperature: params.temperature,
    system,
    user,
    maxOutputTokens: 6500
  });

  let arr: unknown;
  try {
    arr = asArrayFromJsonObjectOnly(raw);
  } catch {
    const repair = await generateJsonWithOpenAI({
      model: params.model,
      temperature: 0.3,
      system,
      user: buildRepairPrompt({ schemaHint: schemaHint(), badJson: raw }),
      maxOutputTokens: 6500
    });
    arr = asArrayFromJsonObjectOnly(repair);
  }

  const parsed = NytheraCharacterBatchSchema.parse(arr);
  // Rewrite ids to guaranteed sequential format inside batch
  const rewritten = parsed.map((seed, i) => ({
    ...seed,
    id: `nyth-${params.batchId}-${String(params.startIndex + i + 1).padStart(3, "0")}`
  }));

  for (const s of rewritten) validateSeedTight(s);
  return rewritten;
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

async function embeddingDedupe(seeds: NytheraCharacterSeed[]) {
  // Optional: best-effort; if embeddings fail, just return input unchanged.
  if (!process.env.OPENAI_API_KEY) return seeds;
  const texts = seeds.map((s) => `${s.name}\n${s.archetype}\n${s.emotional_hook}\n${s.scenario}\n${s.greeting}`);
  const vectors = await embedTextOpenAI({ input: texts });
  const accepted: NytheraCharacterSeed[] = [];
  const acceptedVecs: number[][] = [];
  const rejected: NytheraCharacterSeed[] = [];

  for (let i = 0; i < seeds.length; i += 1) {
    const v = vectors[i]!;
    let tooClose = false;
    for (let j = 0; j < acceptedVecs.length; j += 1) {
      const sim = cosine(v, acceptedVecs[j]!);
      if (sim >= 0.92) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) rejected.push(seeds[i]!);
    else {
      accepted.push(seeds[i]!);
      acceptedVecs.push(v);
    }
  }

  return accepted.length ? accepted : seeds;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const system = buildSystemPrompt();
  if (!system) throw new Error("system prompt missing");

  const accepted: NytheraCharacterSeed[] = [];
  const rejectedTotals: Record<string, number> = {};

  const avoidNames: string[] = [];
  const avoidArchetypes: string[] = [];
  const avoidPhrases: string[] = [];

  // Seed avoid-list with known template starters from older script.
  avoidPhrases.push("Rain taps", "For a few seconds", "The door shuts", "Emergency lights", "The air smells of");

  let attempts = 0;
  while (accepted.length < args.count) {
    attempts += 1;
    if (attempts > 60) throw new Error(`Too many attempts; accepted=${accepted.length}/${args.count}.`);

    const remaining = args.count - accepted.length;
    const want = Math.min(args.chunk, remaining);

    const chunk = await generateChunk({
      model: args.model,
      temperature: args.temperature,
      count: want,
      batchId: args.batchId,
      startIndex: accepted.length,
      avoidNames,
      avoidArchetypes,
      avoidPhrases,
      genreMixHint: args.genreMixHint,
      recentSeeds: accepted.slice(-16).map((s) => ({
        id: s.id,
        name: s.name,
        archetype: s.archetype,
        emotional_hook: s.emotional_hook
      }))
    });

    const { accepted: newAccepted, rejected } = dedupeSeeds(chunk, accepted);
    for (const r of rejected) rejectedTotals[r.reason] = (rejectedTotals[r.reason] ?? 0) + 1;

    // Strengthen avoid-lists with near-miss content (keeps future chunks more diverse).
    for (const r of rejected.slice(0, 16)) {
      avoidNames.push(r.seed.name);
      avoidArchetypes.push(r.seed.archetype);
      avoidPhrases.push(r.seed.greeting.split(/[.!?]/)[0]?.trim() ?? "");
    }

    accepted.push(...newAccepted);

    if (args.useEmbeddings && accepted.length >= 30) {
      try {
        const tightened = await embeddingDedupe(accepted);
        accepted.length = 0;
        accepted.push(...tightened);
      } catch {
        // ignore embeddings failures
      }
    }
  }

  // Final validate + write
  const final = NytheraCharacterBatchSchema.parse(accepted.slice(0, args.count));
  for (const s of final) validateSeedTight(s);

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(final, null, 2)}\n`, "utf8");

  const report = {
    generated: final.length,
    out: args.out,
    model: args.model,
    temperature: args.temperature,
    chunk: args.chunk,
    batchId: args.batchId,
    dedupeRejected: rejectedTotals
  };
  await writeFile(
    args.out.replace(/\.json$/i, ".report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log(`Generated ${final.length} characters.`);
  console.log(`Wrote ${args.out}`);
  console.log(`Wrote ${args.out.replace(/\\.json$/i, ".report.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
