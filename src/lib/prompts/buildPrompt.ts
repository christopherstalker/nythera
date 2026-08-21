import type { ChatMode } from "@/lib/chat-mode";
import { buildExternalPrompt } from "@/lib/prompts/externalSystemPrompt";
import { fantasyModePrompt } from "@/lib/prompts/modes/fantasyMode";
import { realismModePrompt } from "@/lib/prompts/modes/realismMode";

export function buildPromptAddonLayers(input: {
  mode: ChatMode;
  characterMemories: string[];
  userMemories: string[];
}) {
  return {
    modeStyle: input.mode === "fantasy" ? fantasyModePrompt : realismModePrompt,
    sessionMemory: buildExternalPrompt(input)
  };
}

export function modeTemperature(mode: ChatMode, base: number) {
  return mode === "fantasy"
    ? Math.min(1.15, Math.max(base, 0.85))
    : Math.min(0.75, Math.max(base, 0.35));
}
