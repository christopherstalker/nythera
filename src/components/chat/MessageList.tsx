"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  onContinue?: () => void;
  onBranch?: (messageId: string) => void;
};

export function MessageList({ messages, characterName, summary, error, onEdit, onDelete, onRegenerate, onContinue, onBranch }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const [variantByGroup, setVariantByGroup] = useState<Record<string, number>>({});

  useEffect(() => {
    if (nearBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  useEffect(() => {
    setVariantByGroup((current) => {
      const next: Record<string, number> = {};
      for (const item of displayItems) {
        if (item.type === "assistant-variants") {
          const currentIndex = current[item.key];
          next[item.key] =
            currentIndex === undefined || currentIndex >= item.variants.length
              ? item.variants.length - 1
              : currentIndex;
        }
      }
      return next;
    });
  }, [displayItems]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    nearBottomRef.current = distance < 120;
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="chat-scroll relative z-10 flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6" aria-live="polite">
      <div className="nythera-chat-column flex min-h-full flex-col gap-3 sm:gap-4">
        {summary ? (
          <div className="mx-auto mb-2 max-w-2xl rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-center shadow-[var(--glass-highlight)] backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-purple)]">Memory context</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{summary}</p>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="app-surface m-auto max-w-sm px-7 py-8 text-center">
            <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Start a chat with {characterName}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Send a first message or continue from the character greeting.</p>
          </div>
        ) : (
          displayItems.map((item) => {
            if (item.type === "single") {
              return (
                <MessageBubble
                  key={item.message.id}
                  id={item.message.id}
                  role={item.message.role}
                  content={item.message.content}
                  characterName={characterName}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                  onContinue={onContinue}
                  onBranch={onBranch}
                />
              );
            }

            const selectedIndex = variantByGroup[item.key] ?? item.variants.length - 1;
            const selected = item.variants[selectedIndex] ?? item.variants[item.variants.length - 1];

            return (
              <MessageBubble
                key={item.key}
                id={selected.id}
                role={selected.role}
                content={selected.content}
                characterName={characterName}
                onEdit={onEdit}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onContinue={onContinue}
                onBranch={onBranch}
                variantIndex={selectedIndex}
                variantCount={item.variants.length}
                onPreviousVariant={() =>
                  setVariantByGroup((current) => ({
                    ...current,
                    [item.key]: Math.max(0, (current[item.key] ?? selectedIndex) - 1)
                  }))
                }
                onNextVariant={() =>
                  setVariantByGroup((current) => ({
                    ...current,
                    [item.key]: Math.min(item.variants.length - 1, (current[item.key] ?? selectedIndex) + 1)
                  }))
                }
              />
            );
          })
        )}
        {error ? <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  );
}

type DisplayItem =
  | { type: "single"; message: ChatMessage }
  | { type: "assistant-variants"; key: string; variants: ChatMessage[] };

function buildDisplayItems(messages: ChatMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    if (message.role !== "ASSISTANT") {
      items.push({ type: "single", message });
      index += 1;
      continue;
    }

    const variants = [message];
    let nextIndex = index + 1;
    while (nextIndex < messages.length && messages[nextIndex].role === "ASSISTANT") {
      variants.push(messages[nextIndex]);
      nextIndex += 1;
    }

    if (variants.length > 1) {
      const previous = items[items.length - 1];
      const previousKey = previous?.type === "single" ? previous.message.id : "start";
      items.push({
        type: "assistant-variants",
        key: `${previousKey}:${variants[0].id}`,
        variants
      });
    } else {
      items.push({ type: "single", message });
    }

    index = nextIndex;
  }

  return items;
}
