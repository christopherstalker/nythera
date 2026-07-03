"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { ChatMessage } from "@/hooks/useChat";

const NEAR_BOTTOM_THRESHOLD_PX = 120;

type MessageListProps = {
  messages: ChatMessage[];
  characterName: string;
  personaName?: string | null;
  summary?: string | null;
  error?: string | null;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onContinue?: () => void;
  onRewind?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
};

export function MessageList({ messages, characterName, personaName, summary, error, onEdit, onDelete, onRegenerate, onContinue, onRewind, onBranch, onPin }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const latestAssistantId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "ASSISTANT") {
        return messages[index].id;
      }
    }
    return null;
  }, [messages]);
  const [variantByGroup, setVariantByGroup] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!nearBottomRef.current) {
      return;
    }

    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    nearBottomRef.current = distance < NEAR_BOTTOM_THRESHOLD_PX;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="chat-scroll relative z-10 flex-1 overflow-y-auto px-4 pb-8 pt-[calc(84px+env(safe-area-inset-top))] sm:px-6 sm:pb-10 sm:pt-[calc(96px+env(safe-area-inset-top))] md:px-8 md:pt-[calc(92px+env(safe-area-inset-top))]"
      aria-live="polite"
    >
      <div className="nythera-chat-column flex min-h-full flex-col justify-end gap-6 sm:gap-7">
        {summary ? (
          <div
            className="mx-auto mb-2 max-w-2xl rounded-[28px] border border-[var(--border-subtle)] px-5 py-4 text-center shadow-[var(--shadow-soft)]"
            style={{
              background: "color-mix(in oklch, var(--bg-base) 72%, transparent)",
              backdropFilter: "blur(22px) saturate(175%)",
              WebkitBackdropFilter: "blur(22px) saturate(175%)"
            }}
          >
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{summary}</p>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div
            className="m-auto max-w-sm rounded-[var(--radius-surface)] border border-[var(--border-subtle)] px-7 py-8 text-center shadow-[var(--shadow-soft)]"
            style={{
              background: "color-mix(in oklch, var(--bg-surface) 72%, transparent)",
              backdropFilter: "blur(18px) saturate(160%)",
              WebkitBackdropFilter: "blur(18px) saturate(160%)"
            }}
          >
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
                  personaName={personaName}
                  isPinned={item.message.pinned}
                  inputTokens={item.message.inputTokens}
                  outputTokens={item.message.outputTokens}
                  estimatedCost={item.message.estimatedCost}
                  usageEstimated={item.message.usageEstimated}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                  onContinue={onContinue}
                  onRewind={onRewind}
                  onBranch={onBranch}
                  onPin={onPin}
                  isLatestAssistant={item.message.id === latestAssistantId}
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
                personaName={personaName}
                isPinned={selected.pinned}
                inputTokens={selected.inputTokens}
                outputTokens={selected.outputTokens}
                estimatedCost={selected.estimatedCost}
                usageEstimated={selected.usageEstimated}
                onEdit={onEdit}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onContinue={onContinue}
                onRewind={onRewind}
                onBranch={onBranch}
                onPin={onPin}
                isLatestAssistant={selected.id === latestAssistantId}
                variantIndex={selectedIndex}
                variantCount={item.variants.length}
                onPreviousVariant={() =>
                  setVariantByGroup((current) => ({
                    ...current,
                    [item.key]: Math.max(0, (current[item.key] ?? selectedIndex) - 1),
                  }))
                }
                onNextVariant={() =>
                  setVariantByGroup((current) => ({
                    ...current,
                    [item.key]: Math.min(item.variants.length - 1, (current[item.key] ?? selectedIndex) + 1),
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
    while (
      nextIndex < messages.length &&
      messages[nextIndex].role === "ASSISTANT" &&
      !messages[nextIndex].clientRequestId?.startsWith("continue-")
    ) {
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
