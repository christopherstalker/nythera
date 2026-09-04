import type { ChatMode } from "@/lib/chat-mode";
import { buildExternalPrompt } from "@/lib/prompts/externalSystemPrompt";
import { fantasyModePrompt } from "@/lib/prompts/modes/fantasyMode";
import { realismModePrompt } from "@/lib/prompts/modes/realismMode";

export function buildFullPromptAddon(input: {
  mode: ChatMode;
  characterMemories: string[];
  userMemories: string[];
}) {
  const sessionMemory = buildExternalPrompt(input);
  const modePrompt = input.mode === "fantasy" ? fantasyModePrompt : realismModePrompt;
  return `${modePrompt}\n\n${sessionMemory}`;
}
