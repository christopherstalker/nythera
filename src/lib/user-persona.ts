import "server-only";

import type { UserPersona } from "@prisma/client";
import { personaToProfile } from "@/lib/user-persona-profiles";

export function formatUserPersonaForPrompt(persona?: UserPersona | null) {
  if (!persona) {
    return null;
  }

  const activePersona = personaToProfile(persona);

  const lines = [
    `Active user persona: ${activePersona.label}`,
    `User persona name: ${activePersona.displayName}`,
    `User persona summary: ${activePersona.summary}`,
    activePersona.background ? `Background: ${activePersona.background}` : null,
    activePersona.traits.length ? `Traits: ${activePersona.traits.join(", ")}` : null,
    activePersona.likes.length ? `Likes: ${activePersona.likes.join(", ")}` : null,
    activePersona.dislikes.length ? `Dislikes: ${activePersona.dislikes.join(", ")}` : null,
    activePersona.boundaries.length ? `User boundaries: ${activePersona.boundaries.join("; ")}` : null
  ].filter(Boolean);

  return lines.join("\n");
}
