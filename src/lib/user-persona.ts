import "server-only";

import type { UserPersona } from "@prisma/client";

export function formatUserPersonaForPrompt(persona?: UserPersona | null) {
  if (!persona) {
    return null;
  }

  const lines = [
    `User persona name: ${persona.displayName}`,
    `User persona summary: ${persona.summary}`,
    persona.background ? `Background: ${persona.background}` : null,
    persona.traits.length ? `Traits: ${persona.traits.join(", ")}` : null,
    persona.likes.length ? `Likes: ${persona.likes.join(", ")}` : null,
    persona.dislikes.length ? `Dislikes: ${persona.dislikes.join(", ")}` : null,
    persona.boundaries.length ? `User boundaries: ${persona.boundaries.join("; ")}` : null
  ].filter(Boolean);

  return lines.join("\n");
}
