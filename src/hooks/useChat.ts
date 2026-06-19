"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  clientRequestId?: string | null;
};

type SendOptions = {
  model?: string;
  temperature?: number;
  regenerate?: boolean;
  continueChat?: boolean;
  replaceAssistantId?: string;
};

export function useChat(chatId: string, initialMessages: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    setMessages(initialMessages);
    setError(null);
    setIsStreaming(false);

    return () => {
      abortRef.current?.abort();
    };
  }, [chatId, initialMessages]);

  const send = useCallback(
    async (content: string, options?: SendOptions) => {
      const trimmedContent = content.trim();
      const isContinuation = options?.continueChat === true;
      if ((!trimmedContent && !isContinuation) || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      const abortController = new AbortController();
      abortRef.current = abortController;
      const requestId = createRequestId();
      const userMessage: ChatMessage = {
        id: `local-user-${requestId}`,
        role: "USER",
        content: trimmedContent
      };
      const assistantMessage: ChatMessage = {
        id: `local-assistant-${requestId}`,
        role: "ASSISTANT",
        content: "",
        clientRequestId: isContinuation ? `continue-${requestId}` : undefined
      };

      setMessages((current) => {
        if (options?.regenerate || isContinuation) {
          return [...current, assistantMessage];
        }

        return [...current, userMessage, assistantMessage];
      });
      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch(`/api/chats/${chatId}/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            message: trimmedContent,
            model: options?.model,
            temperature: options?.temperature,
            requestId,
            regenerate: options?.regenerate,
            continueChat: isContinuation
          })
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Chat request failed.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processEvent = (event: string) => {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(line.startsWith("data: ") ? 6 : 5))
            .join("\n");

          if (!data) {
            return;
          }

          const payload = JSON.parse(data) as { type: string; text?: string; message?: ChatMessage | string; error?: string };

          if (payload.type === "delta" && payload.text) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: `${message.content}${payload.text}` }
                  : message
              )
            );
          }

          if (payload.type === "message" && payload.message && typeof payload.message !== "string") {
            setMessages((current) =>
              current.map((message) => (message.id === assistantMessage.id ? payload.message as ChatMessage : message))
            );
          }

          if (payload.type === "error") {
            throw new Error(payload.error ?? (typeof payload.message === "string" ? payload.message : undefined) ?? "The model stream failed.");
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              processEvent(buffer);
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";

          for (const event of events) {
            processEvent(event);
          }
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        const message = caught instanceof Error ? caught.message : "Unexpected chat error.";
        setError(message);
        setMessages((current) => current.filter((item) => item.id !== assistantMessage.id || item.content.length > 0));
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
        inFlightRef.current = false;
        setIsStreaming(false);
      }
    },
    [chatId]
  );

  const editMessage = useCallback(async (messageId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const response = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: trimmed })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not edit message.");
      return;
    }

    const body = await response.json();
    setMessages((current) => current.map((message) => (message.id === messageId ? body.message : message)));
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    const response = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not delete message.");
      return;
    }

    setMessages((current) => current.filter((message) => message.id !== messageId));
  }, []);

  const rewindToMessage = useCallback(
    async (messageId: string) => {
      const index = messages.findIndex((message) => message.id === messageId);
      if (index === -1) {
        return;
      }

      const toDelete = messages.slice(index);
      setMessages((current) => current.slice(0, index));

      try {
        await Promise.all(
          toDelete.map((message) =>
            fetch(`/api/messages?id=${encodeURIComponent(message.id)}`, { method: "DELETE" })
          )
        );
      } catch (caught) {
        console.error("Failed to delete messages during rewind:", caught);
        setError("Failed to rewind completely. Please refresh.");
      }
    },
    [messages]
  );

  const branchFromMessage = useCallback(
    async (messageId: string) => {
      const response = await fetch(`/api/chats/${chatId}/branch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not branch chat.");
        return null;
      }

      const body = await response.json();
      return body.chat?.id as string | undefined;
    },
    [chatId]
  );

  return { messages, isStreaming, error, send, editMessage, deleteMessage, rewindToMessage, branchFromMessage };
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
