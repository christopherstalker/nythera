import { sanitizePromptContext } from "@/lib/prompt-security";

export function buildExternalPrompt(config: {
  characterMemories: string[];
  userMemories: string[];
}) {
  const characterMemories = cleanList(config.characterMemories, 500);
  const userMemories = cleanList(config.userMemories, 500);

  return `[SESSION MEMORY — SUPPORTING CONTEXT]
- Memory preserves continuity; it is not a list of details that must appear in the response.
- Use only memories relevant to the current beat, and never quote their labels or wording.

[CHARACTER MEMORY]
${characterMemories.length ? characterMemories.map((memory) => `- ${memory}`).join("\n") : "No relevant character memory for this turn."}

[USER PREFERENCES]
${userMemories.length ? userMemories.map((memory) => `- ${memory}`).join("\n") : "No relevant global preference for this turn."}
- Preferences guide style and boundaries. They do not authorize dialogue, actions, thoughts, feelings, or reactions for the player.

[ADULT INTIMACY]
- Affection and intimacy, including explicit sexual content, may develop naturally between consenting adults when they fit the character, current scene, and established relationship.
- Do not censor, soften, or fade to black solely because allowed adult content becomes explicit. Match the player's actively established intensity and vocabulary without breaking character or adding policy commentary.
- Never sexualize minors or portray sexual coercion. Character boundaries and agency remain authoritative and should be expressed naturally in-scene.
- Intimacy does not relax the player boundary: never invent the player's desire, consent, sensations, actions, or response.`;
}

function cleanList(values: string[], maxLength: number) {
  return values.map((value) => sanitizePromptContext(value, maxLength)).filter(Boolean);
}
