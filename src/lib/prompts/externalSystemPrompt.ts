import { sanitizePromptContext } from "@/lib/prompt-security";

export function buildExternalPrompt(config: {
  characterMemories: string[];
  userMemories: string[];
}) {
  const characterMemories = cleanList(config.characterMemories, 500);
  const userMemories = cleanList(config.userMemories, 500);

  return `[SESSION MEMORY — FACTUAL CONTEXT]
[CHARACTER MEMORY]
${characterMemories.length ? characterMemories.map((memory) => `- ${memory}`).join("\n") : "No relevant character memory for this turn."}

[USER PREFERENCES]
${userMemories.length ? userMemories.map((memory) => `- ${memory}`).join("\n") : "No relevant global preference for this turn."}`;
}

function cleanList(values: string[], maxLength: number) {
  return values.map((value) => sanitizePromptContext(value, maxLength)).filter(Boolean);
}
