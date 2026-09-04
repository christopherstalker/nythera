export const MAX_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_RESPONSE_PROMPT_LENGTH = 2000;
export const ELEVATED_CHAT_MESSAGE_LENGTH = 60_000;
export const ELEVATED_RESPONSE_PROMPT_LENGTH = 60_000;

export type ChatInputLimits = {
  message: number;
  responsePrompt: number;
  elevated: boolean;
};
