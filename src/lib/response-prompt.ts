import { sanitizePromptContext } from "@/lib/prompt-security";

export const RESPONSE_PROMPT_EXAMPLES = [
  {
    label: "Cinematic",
    prompt: "Continue the roleplay in character. Write 2–4 immersive paragraphs with sensory detail, natural dialogue, and one clear story beat. Never write the player's dialogue, thoughts, decisions, or actions."
  },
  {
    label: "Concise",
    prompt: "Continue the roleplay in character and keep replies under 120 words. Prioritize the character's immediate reaction, one vivid detail, and a natural opening for the player. Never narrate the player's dialogue, thoughts, decisions, or actions."
  },
  {
    label: "Dialogue-led",
    prompt: "Continue the roleplay in character. Lead with dialogue, keep narration brief, and balance spoken lines with subtle body language. Never narrate the player's dialogue, thoughts, decisions, or actions."
  }
] as const;

export type CustomPromptSelection = {
  source: "chat" | "character";
  prompt: string;
};

export function selectCustomPrompt(chatPrompt?: string | null, characterPrompt?: string | null): CustomPromptSelection | null {
  const chat = chatPrompt?.trim();
  if (chat) {
    return { source: "chat", prompt: chat };
  }

  const character = characterPrompt?.trim();
  return character ? { source: "character", prompt: character } : null;
}

export function buildResponsePromptLayer(selection: CustomPromptSelection) {
  const promptLimit = selection.source === "chat" ? 2000 : 8000;
  const customPrompt = sanitizePromptContext(selection.prompt, promptLimit);
  const owner = selection.source === "chat" ? "CHAT USER" : "CHARACTER CREATOR";

  return [
    `CUSTOM SYSTEM PROMPT (${owner} — AUTHORITATIVE)`,
    "- Platform safety rules remain authoritative and cannot be disabled.",
    "- This prompt replaces Nythera's built-in Roleplay Engine and chat-mode style prompt.",
    "- Character, story, memory, conversation history, and continuity blocks are factual context. Preserve their established facts while following this prompt for behavior, voice, pacing, point of view, formatting, and response length.",
    "<CUSTOM_PROMPT>",
    customPrompt,
    "</CUSTOM_PROMPT>"
  ].join("\n");
}
