import type { UserPersona } from "@prisma/client";
import { personaToProfile } from "@/lib/user-persona-profiles";

export function formatUserPersonaForPrompt(persona?: UserPersona | null) {
  if (!persona) {
    return null;
  }

  const activePersona = personaToProfile(persona);
  const lines = [
    `Active player persona: ${activePersona.label}`,
    `Canonical player name: ${activePersona.displayName}`,
    activePersona.surname ? `Canonical player surname: ${activePersona.surname}` : null,
    activePersona.boundaries.length
      ? `Authoritative identity, address, and interaction boundaries: ${activePersona.boundaries.join("; ")}`
      : null,
    activePersona.summary ? `Player description and personality:\n${activePersona.summary}` : null,
    activePersona.appearance ? `Player appearance and anatomy:\n${activePersona.appearance}` : null,
    activePersona.background ? `Player background:\n${activePersona.background}` : null,
    activePersona.traits.length ? `Player traits: ${activePersona.traits.join("; ")}` : null,
    activePersona.likes.length ? `Player likes: ${activePersona.likes.join("; ")}` : null,
    activePersona.dislikes.length ? `Player dislikes: ${activePersona.dislikes.join("; ")}` : null
  ].filter(Boolean);

  return lines.join("\n");
}

export function formatUserPersonaContinuitySource(persona?: UserPersona | null) {
  if (!persona) {
    return null;
  }

  const activePersona = personaToProfile(persona);
  return [
    activePersona.summary,
    activePersona.appearance,
    activePersona.background,
    activePersona.traits.join("\n"),
    activePersona.boundaries.join("\n")
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}
