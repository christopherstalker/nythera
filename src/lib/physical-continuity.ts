import { sanitizePromptContext } from "@/lib/prompt-security";

type PhysicalCharacterContext = {
  description: string;
  personality: string;
  scenario?: string | null;
};

export function buildPhysicalContinuityLayer(character: PhysicalCharacterContext, userPersona?: string | null) {
  const characterFacts = extractMeasurementFacts([
    character.description,
    character.personality,
    character.scenario ?? ""
  ].join("\n"));
  const playerFacts = extractMeasurementFacts(userPersona ?? "");

  if (characterFacts.length === 0 && playerFacts.length === 0) {
    return null;
  }

  return [
    "PHYSICAL CONTINUITY (AUTHORITATIVE)",
    "- Treat the explicit measurements below as fixed scene geometry, not optional flavor.",
    "- Derive relative eye lines, reach, and spatial descriptions from those measurements unless posture, terrain, footwear, or elevation explicitly changes the relationship.",
    "- Do not describe a shorter standing character as looking down at a taller standing character without an established physical reason.",
    "- Apply these constraints silently when they are relevant; do not repeatedly announce or fetishize a measurement.",
    characterFacts.length ? `Character measurements: ${characterFacts.join("; ")}` : null,
    playerFacts.length ? `Player measurements: ${playerFacts.join("; ")}` : null
  ].filter(Boolean).join("\n");
}

function extractMeasurementFacts(value: string) {
  const facts = value
    .split(/[\r\n]+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => /\b\d{2,3}(?:\.\d+)?\s*(?:cm|centimet(?:er|re)s?)\b|\b\d(?:\.\d+)?\s*(?:m|met(?:er|re)s?)\s+tall\b|\b\d\s*(?:ft|feet|')\s*\d{1,2}\s*(?:in|inches|")?\b/i.test(part))
    .map((part) => sanitizePromptContext(part, 280))
    .filter(Boolean);

  return Array.from(new Set(facts)).slice(0, 6);
}
