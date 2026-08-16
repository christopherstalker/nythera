"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { partitionMessagesForRewind, shouldRegenerateAfterMessageEdit } from "@/lib/message-actions";
import type { ChatImageAttachment } from "@/lib/chat-attachments";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  clientRequestId?: string | null;
  branchSourceMessageId?: string | null;
  pinned?: boolean;
  model?: string | null;
  provider?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | string | null;
  usageEstimated?: boolean | null;
  attachments?: ChatImageAttachment[];
};

type SendOptions = {
  model?: string;
  temperature?: number;
  responsePrompt?: string;
  regenerate?: boolean;
  continueChat?: boolean;
  regenerateMessageId?: string;
  retryUserMessageId?: string;
  continueMessageId?: string;
  branchMessageId?: string;
  attachments?: ChatImageAttachment[];
};

const CHAT_STREAM_INACTIVITY_TIMEOUT_MS = 55_000;
const CHAT_STREAM_RENDER_INTERVAL_MS = 40;

export function useChat(chatId: string, initialMessages: ChatMessage[], initialSummary?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState<string | null>(() => interruptedResponseNotice(initialMessages));
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(initialSummary ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const rewindInFlightRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const messagesRef = useRef(initialMessages);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    rewindInFlightRef.current = false;
    messagesRef.current = initialMessages;
    setMessages(initialMessages);
    setError(null);
    setProviderNotice(interruptedResponseNotice(initialMessages));
    setIsStreaming(false);
    setRefreshing(false);
    setSummary(initialSummary ?? null);

    return () => {
      abortRef.current?.abort();
    };
  }, [chatId, initialMessages, initialSummary]);

  const send = useCallback(
    async (content: string, options?: SendOptions) => {
      const trimmedContent = content.trim();
      const isContinuation = options?.continueChat === true;
      const isUserRetry = Boolean(options?.retryUserMessageId);
      const isRegeneration = options?.regenerate === true || isUserRetry;
      const attachments = options?.attachments ?? [];
      if ((!trimmedContent && !attachments.length && !isContinuation && !isRegeneration) || inFlightRef.current) {
        return false;
      }

      inFlightRef.current = true;
      const abortController = new AbortController();
      let streamTimedOut = false;
      let requestAccepted = false;
      let assistantContentReceived = false;
      let assistantMessageReceived = false;
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const armStreamTimeout = () => {
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
        }
        streamTimeoutId = setTimeout(() => {
          streamTimedOut = true;
          abortController.abort();
        }, CHAT_STREAM_INACTIVITY_TIMEOUT_MS);
      };
      abortRef.current = abortController;
      const requestId = createRequestId();
      const userMessage: ChatMessage = {
        id: `local-user-${requestId}`,
        role: "USER",
        content: trimmedContent,
        clientRequestId: requestId,
        attachments
      };
      const assistantMessage: ChatMessage = {
        id: `local-assistant-${requestId}`,
        role: "ASSISTANT",
        content: "",
        clientRequestId: isContinuation ? `continue-${requestId}` : undefined
      };
      let pendingAssistantText = "";
      let renderTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const flushAssistantText = () => {
        const nextText = pendingAssistantText;
        pendingAssistantText = "";
        if (!nextText) {
          return;
        }

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: `${message.content}${nextText}` }
              : message
          )
        );
      };
      const queueAssistantText = (text: string) => {
        pendingAssistantText += text;
        if (renderTimeoutId) {
          return;
        }

        renderTimeoutId = setTimeout(() => {
          renderTimeoutId = null;
          flushAssistantText();
        }, CHAT_STREAM_RENDER_INTERVAL_MS);
      };

      setMessages((current) => {
        if (isRegeneration || isContinuation) {
          return [...current, assistantMessage];
        }

        return [...current, userMessage, assistantMessage];
      });
      setIsStreaming(true);
      setError(null);
      setProviderNotice(null);
      armStreamTimeout();

      try {
        const response = await fetch(`/api/chats/${chatId}/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            message: trimmedContent,
            attachmentIds: attachments.map((attachment) => attachment.assetId),
            model: options?.model,
            temperature: options?.temperature,
            responsePrompt: options?.responsePrompt,
            requestId,
            regenerate: options?.regenerate,
            regenerateMessageId: options?.regenerateMessageId,
            retryUserMessageId: options?.retryUserMessageId,
            continueChat: isContinuation,
            continueMessageId: options?.continueMessageId,
            branchMessageId: options?.branchMessageId
          })
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          if (response.status === 429) {
            throw new Error("You're sending messages quickly. One moment, then try again.");
          }
          throw new Error(body?.error ?? "Chat request failed.");
        }
        requestAccepted = true;

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

          if (payload.type === "provider_notice" && typeof payload.message === "string") {
            setProviderNotice(payload.message);
          }

          if (payload.type === "delta" && payload.text) {
            assistantContentReceived = true;
            queueAssistantText(payload.text);
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
            assistantMessageReceived = true;
            if (renderTimeoutId) {
              clearTimeout(renderTimeoutId);
              renderTimeoutId = null;
            }
            pendingAssistantText = "";
            setMessages((current) =>
              current.map((message) => (message.id === assistantMessage.id ? payload.message as ChatMessage : message))
            );
            notifyChatContextChanged(chatId);
          }

          if (payload.type === "error") {
            if (assistantMessageReceived) {
              setProviderNotice("The reply may have ended early, but the delivered text was saved.");
              return;
            }
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

          armStreamTimeout();

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";

          for (const event of events) {
            processEvent(event);
          }
        }
        flushAssistantText();
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError" && !streamTimedOut) {
          pendingAssistantText = "";
          return requestAccepted;
        }

        flushAssistantText();
        if (streamTimedOut) {
          if (assistantContentReceived) {
            setProviderNotice("The connection paused after the reply began. The delivered text is kept; refresh the chat to confirm the saved version.");
            return requestAccepted;
          }
          setError("The model stopped responding. Your message is still here. Send it again.");
          setMessages((current) => current.filter((item) => item.id !== assistantMessage.id || item.content.length > 0));
          return requestAccepted;
        }

        if (assistantMessageReceived || (requestAccepted && assistantContentReceived)) {
          setProviderNotice("The connection ended after the reply began. The delivered text is kept; refresh the chat to confirm the saved version.");
          return requestAccepted;
        }

        const message = caught instanceof Error ? caught.message : "Unexpected chat error.";
        setError(message);
        setMessages((current) => current.filter((item) => item.id !== assistantMessage.id || item.content.length > 0));
      } finally {
        if (renderTimeoutId) {
          clearTimeout(renderTimeoutId);
        }
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
        }
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
        inFlightRef.current = false;
        setIsStreaming(false);
      }
      return requestAccepted;
    },
    [chatId]
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refreshMessages = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return false;
    }
    refreshInFlightRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    setIsStreaming(false);
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/chats/${chatId}?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not refresh the chat.");
      }
      const body = await response.json();
      const refreshedMessages = Array.isArray(body.chat?.messages) ? body.chat.messages as ChatMessage[] : [];
      messagesRef.current = refreshedMessages;
      setMessages(refreshedMessages);
      setProviderNotice(interruptedResponseNotice(refreshedMessages) ?? "Chat refreshed.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh the chat.");
      return false;
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
    }
  }, [chatId]);

  const retryUserMessage = useCallback(async (messageId: string, options?: SendOptions) => {
    if (inFlightRef.current) {
      return;
    }

    const original = messagesRef.current.find((message) => message.id === messageId && message.role === "USER");
    if (!original) {
      return;
    }

    const refreshed = await refreshMessages();
    if (!refreshed) {
      return;
    }

    const persisted = messagesRef.current.find((message) =>
      message.role === "USER" && (
        message.id === original.id ||
        message.clientRequestId === original.clientRequestId ||
        message === messagesRef.current.at(-1) && message.content === original.content
      )
    ) ?? null;

    if (persisted && messagesRef.current.at(-1)?.id === persisted.id) {
      await send(persisted.content, {
        ...options,
        attachments: persisted.attachments,
        regenerate: undefined,
        regenerateMessageId: undefined,
        retryUserMessageId: persisted.id
      });
      return;
    }

    if (persisted) {
      return;
    }

    await send(original.content, { ...options, attachments: original.attachments });
  }, [refreshMessages, send]);

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
    notifyChatContextChanged(chatId);
    if (shouldRegenerateAfterMessageEdit(body.message.role)) {
      await send(trimmed, { regenerate: true });
    }
  }, [chatId, send]);

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
    notifyChatContextChanged(chatId);
  }, [chatId]);

  const rewindToMessage = useCallback(
    async (messageId: string) => {
      if (rewindInFlightRef.current) {
        return;
      }

      const snapshot = messagesRef.current;
      if (!snapshot.some((message) => message.id === messageId)) {
        await refreshMessages();
        return;
      }

      rewindInFlightRef.current = true;
      setError(null);
      const { retained, removed: toDelete } = partitionMessagesForRewind(snapshot, messageId);
      messagesRef.current = retained;
      setMessages(retained);

      try {
        if (toDelete.some((message) => !message.id.startsWith("local-"))) {
          const response = await fetch(`/api/chats/${chatId}/rewind`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageId }),
            cache: "no-store"
          });
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error ?? "The conversation state could not be rewound.");
          }
          const body = await response.json();
          setSummary(typeof body.summary === "string" ? body.summary : null);
        }
        await refreshMessages();
        notifyChatContextChanged(chatId);
      } catch (caught) {
        console.error("Failed to rewind conversation state:", caught);
        const refreshed = await refreshMessages();
        if (!refreshed) {
          messagesRef.current = snapshot;
          setMessages(snapshot);
        }
        setError(caught instanceof Error ? caught.message : "Could not rewind the chat.");
      } finally {
        rewindInFlightRef.current = false;
      }
    },
    [chatId, refreshMessages]
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

  return { messages, summary, isStreaming, refreshing, error, providerNotice, send, retryUserMessage, editMessage, deleteMessage, rewindToMessage, refreshMessages, branchFromMessage, pinMessage, unpinMessage, togglePin };
}

function notifyChatContextChanged(chatId: string) {
  const notify = () => window.dispatchEvent(new CustomEvent("nythera:chat-context-updated", { detail: { chatId } }));
  notify();
  window.setTimeout(notify, 900);
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function interruptedResponseNotice(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "ASSISTANT") return null;
    if (message.role === "USER") {
      return "The previous response was interrupted. Your message was saved; retry it when you're ready.";
    }
  }

  return null;
}
