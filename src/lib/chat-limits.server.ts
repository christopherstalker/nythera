import "server-only";

import {
  ELEVATED_CHAT_MESSAGE_LENGTH,
  ELEVATED_RESPONSE_PROMPT_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_RESPONSE_PROMPT_LENGTH,
  type ChatInputLimits
} from "@/lib/chat-limits";

const ELEVATED_LIMIT_USER_IDS = new Set(
  (process.env.RATE_LIMIT_BYPASS_USER_IDS ?? "")
    .split(",")
    .map((userId) => userId.trim())
    .filter(Boolean)
);

export function getChatInputLimits(userId: string): ChatInputLimits {
  const elevated = ELEVATED_LIMIT_USER_IDS.has(userId);

  return {
    message: elevated ? ELEVATED_CHAT_MESSAGE_LENGTH : MAX_CHAT_MESSAGE_LENGTH,
    responsePrompt: elevated ? ELEVATED_RESPONSE_PROMPT_LENGTH : MAX_RESPONSE_PROMPT_LENGTH,
    elevated
  };
}
