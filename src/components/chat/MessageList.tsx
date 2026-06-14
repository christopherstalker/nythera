"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { ChatMessage } from "@/hooks/useChat";

type MessageListProps = {
  messages: ChatMessage[];
  characterName: string;
  summary?: string | null;
  error?: string | null;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
};

export function MessageList({ messages, characterName, summary, error, onEdit, onDelete, onRegenerate, onBranch }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    if (nearBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    nearBottomRef.current = distance < 120;
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="chat-scroll flex-1 overflow-y-auto px-4 py-4 md:px-5" aria-live="polite">
      <div className="mx-auto flex min-h-full max-w-[900px] flex-col gap-4">
        {summary ? (
          <p className="mx-auto max-w-xl rounded-[var(--radius-pill)] bg-[var(--bg-surface)] px-4 py-2 text-center text-xs italic text-[var(--text-muted)]">
            {summary}
          </p>
        ) : null}
        {messages.length === 0 ? (
          <div className="m-auto max-w-sm text-center">
            <p className="text-base font-semibold text-[var(--text-primary)]">Start a chat with {characterName}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Send a first message or continue from the character greeting.</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              id={message.id}
              role={message.role}
              content={message.content}
              characterName={characterName}
              onEdit={onEdit}
              onDelete={onDelete}
              onRegenerate={onRegenerate}
              onBranch={onBranch}
            />
          ))
        )}
        {error ? <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  );
}
