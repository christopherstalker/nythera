"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { partitionMessagesForRewind, shouldRegenerateAfterMessageEdit } from "@/lib/message-actions";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  clientRequestId?: string | null;
  pinned?: boolean;
  model?: string | null;
  provider?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | string | null;
  usageEstimated?: boolean | null;
};

type SendOptions = {
  model?: string;
  temperature?: number;
  responsePrompt?: string;
  regenerate?: boolean;
  continueChat?: boolean;
  regenerateMessageId?: string;
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
      const isRegeneration = options?.regenerate === true;
      if ((!trimmedContent && !isContinuation && !isRegeneration) || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      const abortController = new AbortController();
      abortRef.current = abortController;
      const requestId = createRequestId();
      const userMessage: ChatMessage = {
        id: `local-user-${requestId}`,
        role: "USER",
        content: trimmedContent,
        clientRequestId: requestId
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
            responsePrompt: options?.responsePrompt,
            requestId,
            regenerate: options?.regenerate,
            regenerateMessageId: options?.regenerateMessageId,
            continueChat: isContinuation
          })
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          if (response.status === 429) {
            throw new Error("You're sending messages quickly. One moment, then try again.");
          }
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

          if (payload.type === "user_message" && payload.message && typeof payload.message !== "string") {
            setMessages((current) =>
              current.map((message) =>
                message.id === userMessage.id || message.clientRequestId === requestId
                  ? payload.message as ChatMessage
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
      if (response.status === 404) {
        if (messageId.startsWith("local-")) {
          setError("Message is still syncing. Try again in a moment.");
          return;
        }
        setMessages((current) => current.filter((message) => message.id !== messageId));
        setError(null);
        return;
      }
      setError(body?.error ?? "Could not edit message.");
      return;
    }

    const body = await response.json();
    const deletedIds = new Set<string>(Array.isArray(body.deletedMessageIds) ? body.deletedMessageIds : []);
    setMessages((current) =>
      current
        .filter((message) => !deletedIds.has(message.id))
        .map((message) => (message.id === messageId ? body.message : message))
    );
    if (shouldRegenerateAfterMessageEdit(body.message.role)) {
      await send(trimmed, { regenerate: true });
    }
  }, [send]);

  const deleteMessage = useCallback(async (messageId: string) => {
    let removedMessage: ChatMessage | null = null;
    let removedIndex = -1;

    setError(null);
    setMessages((current) => {
      removedIndex = current.findIndex((message) => message.id === messageId);
      if (removedIndex === -1) {
        return current;
      }

      removedMessage = current[removedIndex];
      return current.filter((message) => message.id !== messageId);
    });

    if (!removedMessage || messageId.startsWith("local-")) {
      return;
    }

    const response = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (response.status === 404) {
        return;
      }

      const messageToRestore = removedMessage;
      const indexToRestore = removedIndex;
      setMessages((current) => {
        if (current.some((message) => message.id === messageId)) {
          return current;
        }

        const next = [...current];
        next.splice(Math.max(0, Math.min(indexToRestore, next.length)), 0, messageToRestore);
        return next;
      });
      setError(body?.error ?? "Could not delete message.");
      return;
    }
  }, []);

  const rewindToMessage = useCallback(
    async (messageId: string) => {
      const index = messages.findIndex((message) => message.id === messageId);
      if (index === -1) {
        return;
      }

      const { retained, removed: toDelete } = partitionMessagesForRewind(messages, messageId);
      setMessages(retained);

      try {
        if (toDelete.some((message) => !message.id.startsWith("local-"))) {
          const response = await fetch(`/api/chats/${chatId}/rewind`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageId })
          });
          if (!response.ok) {
            throw new Error("The conversation state could not be rewound.");
          }
        }
      } catch (caught) {
        console.error("Failed to rewind conversation state:", caught);
        setMessages(messages);
        setError("Failed to rewind completely. Please refresh.");
      }
    },
    [chatId, messages]
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

  const pinMessage = useCallback(async (messageId: string) => {
    const response = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: true })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not pin message.");
      return;
    }

    const body = await response.json();
    setMessages((current) => current.map((message) => (message.id === messageId ? body.message : message)));
  }, []);

  const unpinMessage = useCallback(async (messageId: string) => {
    const response = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: false })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not unpin message.");
      return;
    }

    const body = await response.json();
    setMessages((current) => current.map((message) => (message.id === messageId ? body.message : message)));
  }, []);

  const togglePin = useCallback(async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    if (message.pinned) {
      await unpinMessage(messageId);
    } else {
      await pinMessage(messageId);
    }
  }, [messages, pinMessage, unpinMessage]);

  return { messages, isStreaming, error, send, editMessage, deleteMessage, rewindToMessage, branchFromMessage, pinMessage, unpinMessage, togglePin };
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
