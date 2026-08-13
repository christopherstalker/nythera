import type { NytheraCharacterSeed } from "./schema";

export const GENRES = [
  "fantasy (high/low, mythic, court, wandering)",
  "science fiction (space, biotech, posthuman, near-future)",
  "romance (slow-burn, rivals, second chance, tender stakes)",
  "slice-of-life (cozy, city life, routines, micro-drama)",
  "dark academia (secret societies, libraries, ethics, obsession)",
  "cyberpunk (neon noir, corp pressure, memory markets)",
  "horror (gothic, cosmic, survival, uncanny domestic)",
  "mystery/noir (private eyes, missing persons, corruption)",
  "supernatural (urban fantasy, occult contracts, ghosts)",
  "historical fiction (period intrigue, letters, war, class)",
  "villain / antagonist (bargains, charisma, moral friction)",
  "mentor/coach (training arcs, accountability, tough love)"
] as const;

export function buildSystemPrompt() {
  return [
    "You are generating a dataset of fictional characters for a roleplay app called Nythera.",
    "Output MUST be valid JSON only. No markdown, no commentary, no trailing commas.",
    "",
    "Hard requirements:",
    "- Characters must feel like living fictional beings with cinematic hooks.",
    "- Viral diversity across genres: " + GENRES.join("; ") + ".",
    "- Avoid repetition and template leakage: do NOT reuse the same greeting cadence, sentence shapes, or scene openers across characters.",
    "- Make each archetype specific (not 'mysterious stranger').",
    "- Greetings are cinematic: 4–8+ sentences, concrete sensory detail, subtext, a meaningful choice, and a scene-forward question.",
    "- emotional_hook is EXACTLY one sentence.",
    "- Never infer or assign dominant, submissive, switch, top, bottom, or other power-exchange roles from gender, anatomy, body type, archetype, status, or stereotypes. Include one only when the generation brief explicitly requires it.",
    "",
    "Safety / product constraint:",
    "- These are seeds for importing characters. Do NOT mention being a bot, model, assistant, or UI instructions in-character.",
    "",
    "JSON schema summary (keys required):",
    "- id (string), name (string), archetype (string), emotional_hook (string, 1 sentence), persona (object), scenario (string), greeting (string), conversation_hooks (string[]), tags (string[])"
  ].join("\n");
}

export function buildUserPrompt(input: {
  count: number;
  batchId: string;
  genreMixHint?: string;
  avoidNames?: string[];
  avoidArchetypes?: string[];
  avoidPhrases?: string[];
  recentSeeds?: Array<Pick<NytheraCharacterSeed, "id" | "name" | "archetype" | "emotional_hook">>;
}) {
  const avoidNames = (input.avoidNames ?? []).slice(0, 120);
  const avoidArchetypes = (input.avoidArchetypes ?? []).slice(0, 120);
  const avoidPhrases = (input.avoidPhrases ?? []).slice(0, 80);

  return [
    `Generate ${input.count} unique character objects as a JSON array.`,
    `Batch id: ${input.batchId}`,
    input.genreMixHint ? `Genre mix guidance: ${input.genreMixHint}` : "Genre mix guidance: spread broadly across genres; avoid clumping.",
    "",
    "Uniqueness constraints:",
    "- Names must not repeat (including small spelling changes).",
    "- Archetypes must not repeat; keep them highly specific and scene-anchored.",
    "- Do not reuse these overused openings: 'The air smells of', 'Rain taps', 'For a few seconds', 'The door shuts', 'Emergency lights'. Invent new openings.",
    "- Avoid these names (do not use): " + (avoidNames.length ? JSON.stringify(avoidNames) : "[]"),
    "- Avoid these archetype phrasings (do not use): " + (avoidArchetypes.length ? JSON.stringify(avoidArchetypes) : "[]"),
    "- Avoid these phrases anywhere (do not use): " + (avoidPhrases.length ? JSON.stringify(avoidPhrases) : "[]"),
    "",
    input.recentSeeds?.length
      ? [
          "Recently accepted seeds (do not echo their beats, names, or archetypes):",
          JSON.stringify(input.recentSeeds.slice(-16), null, 2)
        ].join("\n")
      : "Recently accepted seeds: []",
    "",
    "persona requirements (structured behavioral system):",
    "- behavioral_drives: 3–12 concrete motivations (not adjectives-only).",
    "- boundaries: 2–12 consent + safety + tonal boundaries (in-fiction, not policy talk).",
    "- speaking_style: voice (one vivid line), pacing, initiative, intimacy, taboo_avoidance (list).",
    "- relationship_dynamics: default style, push_pull, trust_triggers, rupture_triggers, repair_style.",
    "- memory_model: what_they_notice, what_they_misread, what_they_hide.",
    "- scene_engine: preferred_conflict, escalation_levers, deescalation_levers, questions_they_ask (3–10).",
    "",
    "tags:",
    "- 4–18 short tags. Include genre + role + vibe + theme (e.g., 'neon-noir', 'found-family', 'heist', 'gothic').",
    "",
    "id rules:",
    "- Use format `nyth-<batchId>-<nnn>` with nnn zero-padded per array order."
  ].join("\n");
}

export function buildRepairPrompt(params: { schemaHint: string; badJson: string }) {
  return [
    "You output invalid JSON or schema-invalid objects.",
    "Fix the output to match the schema exactly, with the same intended characters.",
    "Return ONLY a JSON array, no markdown.",
    "",
    "Schema hint:",
    params.schemaHint,
    "",
    "Bad output to repair:",
    params.badJson
  ].join("\n");
}
