import type { UserPersona } from "@prisma/client";
import { personaToProfile } from "@/lib/user-persona-profiles";

const IDENTITY_FIELD = /^(?:gender|pronouns?|species|race|ethnicity|nationality|age|orientation|identity)\s*:/i;
const MEASUREMENT_PARENTHETICAL = /\s*\([^)]*\b(?:\d+(?:[.,]\d+)?\s*(?:cm|ft|feet|foot|in(?:ches)?|kg|lbs?|pounds?)|\d+\s*[′'])[^)]*\)/gi;

export function formatUserPersonaForPrompt(persona?: UserPersona | null) {
  if (!persona) {
    return null;
  }

  const activePersona = personaToProfile(persona);
  const identitySummary = extractIdentitySummary(activePersona.summary);
  const lines = [
    `Active player persona: ${activePersona.label}`,
    `Canonical player name: ${activePersona.displayName}`,
    activePersona.surname ? `Canonical player surname: ${activePersona.surname}` : null,
    identitySummary ? `Canonical player identity: ${identitySummary}` : null,
    activePersona.boundaries.length
      ? `Authoritative identity, address, and interaction boundaries: ${activePersona.boundaries.join("; ")}`
      : null
  ].filter(Boolean);

  return lines.join("\n");
}

export function formatUserPersonaContinuitySource(persona?: UserPersona | null) {
  if (!persona) {
    return null;
  }

  const activePersona = personaToProfile(persona);
  return [activePersona.summary, activePersona.background, activePersona.traits.join("\n")]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}

function extractIdentitySummary(summary: string) {
  return summary
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => IDENTITY_FIELD.test(line))
    .map((line) => {
      const withoutMeasurements = line.replace(MEASUREMENT_PARENTHETICAL, "").trim();
      const firstSentence = withoutMeasurements.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
      return firstSentence || withoutMeasurements;
    })
    .filter(Boolean)
    .join(" ");
}
