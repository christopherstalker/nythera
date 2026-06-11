"use client";

import { useCallback, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
};

type SendOptions = {
  model?: string;
  temperature?: number;
};

export function useChat(chatId: string, initialMessages: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (content: string, options?: SendOptions) => {
      if (!content.trim() || isStreaming) {
        return;
      }

      const userMessage: ChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "USER",
        content
      };
      const assistantMessage: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: ""
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch(`/api/chats/${chatId}/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: content,
            model: options?.model,
            temperature: options?.temperature
          })
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Chat request failed.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const data = event
              .split("\n")
              .find((line) => line.startsWith("data: "))
              ?.slice(6);

            if (!data) {
              continue;
            }

            const payload = JSON.parse(data) as { type: string; text?: string; message?: ChatMessage; error?: string };

            if (payload.type === "delta" && payload.text) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessage.id
                    ? { ...message, content: `${message.content}${payload.text}` }
                    : message
                )
              );
            }

            if (payload.type === "message" && payload.message) {
              setMessages((current) =>
                current.map((message) => (message.id === assistantMessage.id ? payload.message! : message))
              );
            }

            if (payload.type === "error") {
              throw new Error(payload.error ?? "The model stream failed.");
            }
          }
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unexpected chat error.";
        setError(message);
        setMessages((current) =>
          current.filter((item) => item.id !== assistantMessage.id || item.content.length > 0)
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [chatId, isStreaming]
  );

  return { messages, isStreaming, error, send };
}
