"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { ChatMessage } from "@/hooks/useChat";

const NEAR_BOTTOM_THRESHOLD_PX = 120;
const MESSAGE_ROW_ESTIMATE_PX = 180;

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
  const nearBottomRef = useRef(true);
  const previousRowCountRef = useRef(0);
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);
  const rows = useMemo(() => buildVirtualRows({ displayItems, summary, error, isEmpty: messages.length === 0 }), [displayItems, error, messages.length, summary]);
  const latestAssistantId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "ASSISTANT") {
        return messages[index].id;
      }
    }
    return null;
  }, [messages]);
  const [variantByGroup, setVariantByGroup] = useState<Record<string, number>>({});
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index]?.key ?? index,
    estimateSize: (index) => estimateRowSize(rows[index]),
    overscan: 8
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const bottomOffset = Math.max(0, (scrollRef.current?.clientHeight ?? 0) - totalSize);

  useEffect(() => {
    if (!nearBottomRef.current) {
      return;
    }

    const behavior = rows.length === previousRowCountRef.current ? "auto" : "smooth";
    previousRowCountRef.current = rows.length;
    virtualizer.scrollToIndex(Math.max(0, rows.length - 1), { align: "end", behavior });
  }, [messages, rows.length, virtualizer]);

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

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    nearBottomRef.current = distance < NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  const selectPreviousVariant = useCallback((groupKey: string, selectedIndex: number) => {
    setVariantByGroup((current) => ({
      ...current,
      [groupKey]: Math.max(0, (current[groupKey] ?? selectedIndex) - 1)
    }));
  }, []);

  const selectNextVariant = useCallback((groupKey: string, selectedIndex: number, variantCount: number) => {
    setVariantByGroup((current) => ({
      ...current,
      [groupKey]: Math.min(variantCount - 1, (current[groupKey] ?? selectedIndex) + 1)
    }));
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="chat-scroll relative z-10 flex-1 overflow-y-auto px-4 pb-8 pt-[calc(84px+env(safe-area-inset-top))] sm:px-6 sm:pb-10 sm:pt-[calc(96px+env(safe-area-inset-top))] md:px-8 md:pt-[calc(92px+env(safe-area-inset-top))]"
      aria-live="polite"
    >
      <div
        className="nythera-chat-column relative mx-auto w-full"
        style={{ height: Math.max(totalSize, scrollRef.current?.clientHeight ?? 0) }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) {
            return null;
          }

          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full pb-6 sm:pb-7"
              style={{
                transform: `translateY(${virtualRow.start + bottomOffset}px)`
              }}
            >
              <MessageRow
                row={row}
                characterName={characterName}
                personaName={personaName}
                latestAssistantId={latestAssistantId}
                variantByGroup={variantByGroup}
                onEdit={onEdit}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onContinue={onContinue}
                onRewind={onRewind}
                onBranch={onBranch}
                onPin={onPin}
                onPreviousVariant={selectPreviousVariant}
                onNextVariant={selectNextVariant}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DisplayItem =
  | { type: "single"; message: ChatMessage }
  | { type: "assistant-variants"; key: string; variants: ChatMessage[] };

type VirtualRow =
  | { type: "summary"; key: "summary"; summary: string }
  | { type: "empty"; key: "empty" }
  | { type: "single"; key: string; message: ChatMessage }
  | { type: "assistant-variants"; key: string; variants: ChatMessage[] }
  | { type: "error"; key: "error"; error: string };

function MessageRow({
  row,
  characterName,
  personaName,
  latestAssistantId,
  variantByGroup,
  onEdit,
  onDelete,
  onRegenerate,
  onContinue,
  onRewind,
  onBranch,
  onPin,
  onPreviousVariant,
  onNextVariant
}: {
  row: VirtualRow;
  characterName: string;
  personaName?: string | null;
  latestAssistantId: string | null;
  variantByGroup: Record<string, number>;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onContinue?: () => void;
  onRewind?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onPreviousVariant: (groupKey: string, selectedIndex: number) => void;
  onNextVariant: (groupKey: string, selectedIndex: number, variantCount: number) => void;
}) {
  if (row.type === "summary") {
    return (
      <div
        className="mx-auto mb-2 max-w-2xl rounded-[28px] border border-[var(--border-subtle)] px-5 py-4 text-center shadow-[var(--shadow-soft)]"
        style={{
          background: "color-mix(in oklch, var(--bg-base) 72%, transparent)",
          backdropFilter: "blur(22px) saturate(175%)",
          WebkitBackdropFilter: "blur(22px) saturate(175%)"
        }}
      >
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{row.summary}</p>
      </div>
    );
  }

  if (row.type === "empty") {
    return (
      <div
        className="mx-auto max-w-sm rounded-[var(--radius-surface)] border border-[var(--border-subtle)] px-7 py-8 text-center shadow-[var(--shadow-soft)]"
        style={{
          background: "color-mix(in oklch, var(--bg-surface) 72%, transparent)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)"
        }}
      >
        <p className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Start a chat with {characterName}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Send a first message or continue from the character greeting.</p>
      </div>
    );
  }

  if (row.type === "error") {
    return <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{row.error}</p>;
  }

  if (row.type === "single") {
    return (
      <MessageBubble
        id={row.message.id}
        role={row.message.role}
        content={row.message.content}
        characterName={characterName}
        personaName={personaName}
        isPinned={row.message.pinned}
        inputTokens={row.message.inputTokens}
        outputTokens={row.message.outputTokens}
        estimatedCost={row.message.estimatedCost}
        usageEstimated={row.message.usageEstimated}
        onEdit={onEdit}
        onDelete={onDelete}
        onRegenerate={onRegenerate}
        onContinue={onContinue}
        onRewind={onRewind}
        onBranch={onBranch}
        onPin={onPin}
        isLatestAssistant={row.message.id === latestAssistantId}
      />
    );
  }

  const selectedIndex = variantByGroup[row.key] ?? row.variants.length - 1;
  const selected = row.variants[selectedIndex] ?? row.variants[row.variants.length - 1];

  return (
    <MessageBubble
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
      variantCount={row.variants.length}
      onPreviousVariant={() => onPreviousVariant(row.key, selectedIndex)}
      onNextVariant={() => onNextVariant(row.key, selectedIndex, row.variants.length)}
    />
  );
}

function buildVirtualRows({
  displayItems,
  summary,
  error,
  isEmpty
}: {
  displayItems: DisplayItem[];
  summary?: string | null;
  error?: string | null;
  isEmpty: boolean;
}): VirtualRow[] {
  const rows: VirtualRow[] = [];
  if (summary) {
    rows.push({ type: "summary", key: "summary", summary });
  }

  if (isEmpty) {
    rows.push({ type: "empty", key: "empty" });
  } else {
    for (const item of displayItems) {
      rows.push(item.type === "single" ? { type: "single", key: item.message.id, message: item.message } : item);
    }
  }

  if (error) {
    rows.push({ type: "error", key: "error", error });
  }

  return rows;
}

function estimateRowSize(row: VirtualRow | undefined) {
  if (!row) return MESSAGE_ROW_ESTIMATE_PX;
  if (row.type === "summary") return 96;
  if (row.type === "empty") return 220;
  if (row.type === "error") return 80;
  if (row.type === "single") {
    return row.message.role === "USER" ? 120 : Math.max(160, Math.min(520, row.message.content.length * 0.36));
  }
  const contentLength = row.variants[row.variants.length - 1]?.content.length ?? 0;
  return Math.max(180, Math.min(560, contentLength * 0.36));
}

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
