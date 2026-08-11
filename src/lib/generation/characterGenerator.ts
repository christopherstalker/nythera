import "server-only";

import { z } from "zod";
import type { GeneratedCharacterConcept } from "@/lib/generation/character-generator-types";
import { streamGatewayResponse } from "@/lib/llm-gateway";
import { sanitizePromptContext } from "@/lib/prompt-security";
import { generateSimpleCharacterDraft } from "@/lib/simple-character-generation";
import type { ProviderKeys } from "@/lib/user-keys";

const conceptSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(240),
  personality: z.string().trim().min(40).max(5000),
  background: z.string().trim().min(40).max(5000),
  speechPattern: z.string().trim().min(20).max(1200),
  scenario: z.string().trim().min(20).max(5000),
  tags: z.array(z.string().trim().min(1).max(32)).min(1).max(12),
  firstMessage: z.string().trim().min(40).max(2000),
  avatarPrompt: z.string().trim().min(10).max(800)
});

export async function generateCharacter(
  userConcept: string,
  input: { userId: string; providerKeys?: ProviderKeys; fallbackName?: string }
): Promise<GeneratedCharacterConcept> {
  const providerKeys = input.providerKeys ?? [];
  const concept = sanitizePromptContext(userConcept, 2000);
  if (providerKeys.length === 0) return localFallback(concept, input.fallbackName);

  const draft = await callJsonStage({
    prompt: `You are a character creation expert for an AI roleplay platform.
Expand the concept inside <concept> into a rich, specific character profile.

<concept>${concept}</concept>

Return exactly this JSON shape:
{
  "name": "Creative, fitting name",
  "description": "One-sentence hook, maximum 20 words",
  "personality": "Three to five sentences with traits, flaws, contrasts, and quirks",
  "background": "Four to six sentences explaining history and motivation",
  "speechPattern": "Two to three sentences describing vocabulary, rhythm, verbal tics, or catchphrases",
  "scenario": "Two to three sentences establishing the opening situation",
  "tags": ["four", "searchable", "relevant", "tags"],
  "firstMessage": "An engaging two-to-four sentence opening written in character",
  "avatarPrompt": "A detailed, safe portrait-generation prompt"
}

Make the personality nuanced, the voice recognizable in a blind test, and the opening immediately actionable. Avoid generic filler. Return JSON only.`,
    providerKeys,
    userId: input.userId,
    temperature: 0.85
  });

  const enriched = await callJsonStage({
    prompt: `Act as a demanding character editor. Improve weak or generic fields in this profile.
Ensure the personality contains contrast, the background explains motivation, the speech pattern is unmistakable, and the first message creates an immediate hook.
Preserve the JSON shape and return JSON only.

<profile>${JSON.stringify(draft)}</profile>`,
    providerKeys,
    userId: input.userId,
    temperature: 0.7
  });

  const consistent = await callJsonStage({
    prompt: `Perform a final consistency pass on this character.
The background must explain the personality, the speech must match both, and the first message must fit the scenario. Correct contradictions and generic wording. Preserve every required field and return JSON only.

<profile>${JSON.stringify(enriched)}</profile>`,
    providerKeys,
    userId: input.userId,
    temperature: 0.5
  });

  return conceptSchema.parse(consistent);
}

async function callJsonStage(input: { prompt: string; providerKeys: ProviderKeys; userId: string; temperature: number }) {
  let raw = "";
  for await (const chunk of streamGatewayResponse({
    messages: [
      { role: "system", content: "Return only valid JSON matching the requested object shape. Do not use Markdown." },
      { role: "user", content: input.prompt }
    ],
    model: input.providerKeys[0]?.defaultModel || "gpt-4o-mini",
    temperature: input.temperature,
    userId: input.userId,
    chatId: "character-generate-pipeline",
    providerKeys: input.providerKeys
  })) {
    if (chunk.type === "delta") raw += chunk.text;
    if (chunk.type === "error") throw new Error(chunk.message);
  }
  return JSON.parse(extractJson(raw)) as unknown;
}

function localFallback(concept: string, fallbackName?: string): GeneratedCharacterConcept {
  const name = fallbackName?.trim() || inferredName(concept) || "New Character";
  const description = concept.length >= 10 ? concept.slice(0, 200) : `${concept} roleplay character`;
  const draft = generateSimpleCharacterDraft({ name, description });
  return conceptSchema.parse({
    name,
    description,
    personality: draft.personality,
    background: draft.scenario,
    speechPattern: draft.speakingStyle,
    scenario: draft.scenario,
    tags: draft.tags,
    firstMessage: draft.greeting,
    avatarPrompt: `Detailed character portrait of ${name}. ${description}. Expressive face, cohesive costume, soft cinematic lighting.`
  });
}

function inferredName(concept: string) {
  const match = concept.match(/(?:named|called)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)/u);
  return match?.[1]?.slice(0, 80) ?? "";
}

function extractJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model returned invalid character JSON.");
  return raw.slice(start, end + 1);
}
