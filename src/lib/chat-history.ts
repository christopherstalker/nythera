import "server-only";

import { streamGatewayResponse } from "@/lib/llm-gateway";
import { titleFromMessage } from "@/lib/utils";
import type { ProviderKeys } from "@/lib/user-keys";

export async function generateChatTitle(input: {
  userMessage: string;
  assistantMessage: string;
  model: string;
  providerKeys?: ProviderKeys;
}) {
  const fallback = titleFromMessage(input.userMessage || input.assistantMessage || "New chat");

  try {
    let title = "";
    for await (const chunk of streamGatewayResponse({
      messages: [
        {
          role: "system",
          content:
            "Generate a concise chat title. Return only the title, 2-7 words, no quotes, no punctuation at the end."
        },
        {
          role: "user",
          content: `User: ${input.userMessage.slice(0, 500)}\nAssistant: ${input.assistantMessage.slice(0, 500)}`
        }
      ],
      model: input.model,
      temperature: 0.2,
      userId: "system-title",
      chatId: "system-title",
      providerKeys: input.providerKeys
    })) {
      if (chunk.type === "delta") {
        title += chunk.text;
      }

      if (chunk.type === "error") {
        throw new Error(chunk.message);
      }
    }

    return cleanTitle(title) || fallback;
  } catch (error) {
    console.warn("LLM title generation failed; using local fallback.", error instanceof Error ? error.message : error);
    return fallback;
  }
}

function cleanTitle(value: string) {
  return value
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!:;,-]+$/g, "")
    .slice(0, 54);
}
