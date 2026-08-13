"use client";

import { memo, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { RichTextToolbar } from "@/components/rich-text/rich-text-toolbar";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { springSnappy, springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, MoreHorizontal, PenLine, Pin, RefreshCw, SendHorizontal, Volume2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { applyRichTextFormat, richTextFormatFromShortcut } from "@/lib/rich-text-formatting";
import type { ChatImageAttachment } from "@/lib/chat-attachments";

const LONG_PRESS_DELAY_MS = 500;
const DELETE_EXIT_DELAY_MS = 140;

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  attachments?: ChatImageAttachment[];
  characterName: string;
  characterAvatarUrl?: string | null;
  personaName?: string | null;
  personaAvatarUrl?: string | null;
  isPinned?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | string | null;
  usageEstimated?: boolean | null;
  onEdit?: (messageId: string, content: string) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onRegenerate?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onContinue?: (messageId: string) => void;
  onRewind?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  isLatestAssistant?: boolean;
  variantIndex?: number;
  variantCount?: number;
  onPreviousVariant?: () => void;
  onNextVariant?: () => void;
};

function MessageBubbleComponent({
  id,
  role,
  content,
  attachments = [],
  characterName,
  characterAvatarUrl,
  personaName,
  personaAvatarUrl,
  isPinned,
  inputTokens,
  outputTokens,
  estimatedCost,
  usageEstimated,
  onEdit,
  onDelete,
  onRegenerate,
  onRetry,
  onContinue,
  onRewind,
  onBranch,
  onPin,
  isLatestAssistant = false,
  variantIndex,
  variantCount,
  onPreviousVariant,
  onNextVariant
}: MessageBubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(content);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUser = role === "USER";
  const hasVariants = !isUser && variantCount !== undefined && variantCount > 1 && variantIndex !== undefined;

  function toggleSpeaking() {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(content.replace(/[*_#`]/g, ""));
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  if (role === "SYSTEM") {
    return (
      <p className="px-4 py-2 text-center text-xs italic text-[var(--text-muted)]">
        {content}
      </p>
    );
  }

  function edit() {
    setEditDraft(content);
    setEditError(null);
    setIsEditing(true);
    setActionsOpen(false);
  }

  async function saveEdit() {
    const next = editDraft.trim();
    if (!next || next === content || savingEdit) {
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      await onEdit?.(id, next);
      setIsEditing(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not save this message.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function report() {
    const details = window.prompt("Report details", "Problematic message");
    if (details === null) return;

    try {
      const response = await fetch(`/api/messages/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Message report", details })
      });

      if (!response.ok) {
        window.alert("Could not submit report.");
        return;
      }
      window.alert("Report submitted.");
    } catch {
      window.alert("Could not submit report.");
    }
  }

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setActionsOpen(true);
  };

  const openActions = () => setActionsOpen(true);

  const handleTouchStart = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }

    touchTimerRef.current = setTimeout(() => {
      setActionsOpen(true);
    }, LONG_PRESS_DELAY_MS);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      window.alert("Failed to copy text");
    }
  };

  function deleteWithMotion() {
    if (isDeleting) {
      return;
    }

    setActionsOpen(false);
    setIsDeleting(true);
    window.setTimeout(() => {
      void onDelete?.(id);
    }, DELETE_EXIT_DELAY_MS);
  }

  return (
    <motion.div
      className={cn(
        "group/message relative flex w-full message-enter",
        isDeleting && "message-exit pointer-events-none"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div className="grid w-full min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-4 border-b border-[var(--codex-rule)] pb-7 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-5">
        <motion.div animate={isSpeaking ? { scale: [1, 1.07, 1], filter: ["brightness(1)", "brightness(1.25)", "brightness(1)"] } : { scale: 1 }} transition={isSpeaking ? { duration: 0.75, repeat: Infinity } : springSoft}>
          <Avatar name={isUser ? personaName || "You" : characterName} src={isUser ? personaAvatarUrl : characterAvatarUrl} size="sm" className={cn("h-10 w-10 border-[var(--codex-rule)]", isUser && "text-[var(--codex-mint)]")} />
        </motion.div>
        <div className="flex min-w-0 flex-col items-start">
          <p className={cn("mb-3 text-[10px] font-semibold uppercase tracking-[.23em]", isUser ? "text-[var(--codex-mint)]" : "text-[var(--codex-violet)]")}>
            {isUser ? personaName || "You" : characterName}
            {!isUser && content ? <button type="button" onClick={toggleSpeaking} className="focus-ring ml-3 inline-flex align-middle text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={isSpeaking ? "Stop speaking" : "Speak with animated avatar"}><Volume2 className={cn("h-3.5 w-3.5", isSpeaking && "text-[var(--accent-mint)]")} /></button> : null}
          </p>
        {!isUser && content && (inputTokens !== null && inputTokens !== undefined || outputTokens !== null && outputTokens !== undefined) ? (
          <span
            className="mb-1.5 ml-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] shadow-[var(--glass-highlight)]"
            style={{ background: "color-mix(in oklch, var(--bg-base) 72%, transparent)" }}
            title={estimatedCost !== null && estimatedCost !== undefined ? `Estimated cost ${formatEstimatedCost(estimatedCost)}` : "Token usage"}
          >
            <Volume2 className="h-3.5 w-3.5" />
            {usageEstimated ? "~" : ""}{outputTokens ?? 0}
          </span>
        ) : null}

        <motion.div
          className={cn(
            "chat-message-content relative max-w-[760px] overflow-hidden",
            isUser ? "max-w-[680px]" : "w-full"
          )}
          style={{
            fontFamily: "var(--chat-font-family, var(--font-editorial))",
            fontSize: "var(--chat-font-size, 24px)",
            fontWeight: "var(--chat-font-weight, 500)",
            lineHeight: "var(--chat-line-height, 1.5)",
            color: "var(--chat-text-color, var(--codex-ivory))",
            textShadow: "0 1px 3px rgba(0,0,0,.9), 0 2px 16px rgba(0,0,0,.6)"
          } as CSSProperties}
        >
          {isPinned && (
            <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] text-[var(--accent-purple)]">
              <Pin className="h-3.5 w-3.5" />
            </span>
          )}
          {attachments.length ? (
            <div className="mb-4 grid max-w-xl grid-cols-2 gap-2">
              {attachments.map((attachment) => (
                <a key={attachment.assetId} href={attachment.url} target="_blank" rel="noreferrer" className={cn("focus-ring block overflow-hidden rounded-sm border border-white/15 bg-black/35", attachments.length === 1 && "col-span-2")}>
                  <img src={attachment.url} alt={attachment.name || "Message attachment"} className="max-h-[520px] w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          {content ? (
            <div className="chat-message-copy-locked"><RichMessageText text={content} /></div>
          ) : !attachments.length ? (
            <TypingIndicator />
          ) : null}
        </motion.div>

        {hasVariants ? (
          <div className="mt-5 flex w-full items-center gap-3 border-t border-white/10 pt-3 font-sans" aria-label={`Version ${variantIndex! + 1} of ${variantCount}`}>
            <button type="button" onClick={() => onPreviousVariant?.()} disabled={variantIndex! <= 0} className="focus-ring inline-flex h-9 items-center gap-1 rounded-sm px-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Previous</button>
            <span className="text-[11px] uppercase tracking-[.12em] text-[var(--text-muted)]">Version {variantIndex! + 1} of {variantCount}</span>
            <button type="button" onClick={() => onNextVariant?.()} disabled={variantIndex! >= variantCount! - 1} className="focus-ring inline-flex h-9 items-center gap-1 rounded-sm px-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30">Next<ChevronRight className="h-4 w-4" /></button>
          </div>
        ) : null}

        {content && !isEditing ? (
          <div
            className={cn(
              "mt-4 flex w-full flex-wrap items-center gap-1.5 font-sans",
              !isLatestAssistant && "sm:opacity-65 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100"
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <ActionButton label={isUser ? "Edit message" : "Edit response"} onClick={edit} showLabel>
                <PenLine className="h-4 w-4" />
              </ActionButton>
              {isUser && onRetry ? (
                <ActionButton label="Send again" onClick={() => onRetry(id)} showLabel>
                  <RefreshCw className="h-4 w-4" />
                </ActionButton>
              ) : null}
              {!isUser ? (
                <>
                  {onRegenerate ? (
                    <ActionButton label="Try another" onClick={() => onRegenerate(id)} showLabel>
                      <RefreshCw className="h-4 w-4" />
                    </ActionButton>
                  ) : null}
                  {onContinue ? (
                    <ActionButton label="Continue" onClick={() => onContinue(id)} showLabel>
                      <SendHorizontal className="h-4 w-4" />
                    </ActionButton>
                  ) : null}
                </>
              ) : null}
              <ActionButton label="More" onClick={openActions} showLabel>
                <MoreHorizontal className="h-4 w-4" />
              </ActionButton>
            </div>
          </div>
        ) : null}
      </div>
      </div>

      <span className="sr-only">{isUser ? personaName || "You" : characterName}</span>

      {actionsOpen ? (
        <MessageContextMenu
          isOpen
          onClose={() => setActionsOpen(false)}
          onCopy={copyToClipboard}
          onEdit={edit}
          onRegenerate={!isUser && onRegenerate ? () => onRegenerate(id) : undefined}
          onContinue={!isUser && onContinue ? () => onContinue(id) : undefined}
          onRewind={onRewind ? () => onRewind(id) : undefined}
          onPin={onPin ? () => onPin(id) : undefined}
          onBranch={onBranch ? () => onBranch(id) : undefined}
          onReport={report}
          onDelete={deleteWithMotion}
          isUserMessage={isUser}
          isPinned={isPinned}
        />
      ) : null}
      {isEditing ? createPortal(
        <MessageEditor
          title={isUser ? "Edit your message" : "Edit response"}
          value={editDraft}
          originalValue={content}
          error={editError}
          saving={savingEdit}
          textareaRef={editTextareaRef}
          onChange={setEditDraft}
          onCancel={() => setIsEditing(false)}
          onSave={() => void saveEdit()}
        />,
        document.body
      ) : null}
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent, areMessageBubblePropsEqual);

function MessageEditor({
  title,
  value,
  originalValue,
  error,
  saving,
  textareaRef,
  onChange,
  onCancel,
  onSave
}: {
  title: string;
  value: string;
  originalValue: string;
  error: string | null;
  saving: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-end bg-black/70 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close editor" className="absolute inset-0" onClick={onCancel} />
      <section className="relative flex h-[min(82dvh,760px)] w-full min-w-0 flex-col overflow-hidden border border-white/15 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,.65)] sm:max-w-4xl sm:rounded-sm">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <p className="font-sans text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="mt-1 hidden font-sans text-xs text-[var(--text-muted)] sm:block">Formatting is preserved · Ctrl/⌘ + Enter to save</p>
          </div>
          <button type="button" onClick={onCancel} className="focus-ring h-9 rounded-full border border-white/15 px-3 font-sans text-xs text-[var(--text-secondary)]">Close</button>
        </header>
        <div className="shrink-0 overflow-x-auto border-b border-white/10 px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <RichTextToolbar textareaRef={textareaRef} value={value} onChange={onChange} compact />
        </div>
        <textarea
          ref={textareaRef}
          autoFocus
          aria-label="Edit message text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const format = richTextFormatFromShortcut(event.key, event.ctrlKey || event.metaKey);
            if (format) {
              event.preventDefault();
              const formatted = applyRichTextFormat(value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, format);
              onChange(formatted.value);
              requestAnimationFrame(() => {
                textareaRef.current?.focus();
                textareaRef.current?.setSelectionRange(formatted.selectionStart, formatted.selectionEnd);
              });
            } else if (event.key === "Escape") {
              onCancel();
            } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onSave();
            }
          }}
          className="focus-ring min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-4 font-[var(--chat-font-family,var(--font-editorial))] text-[clamp(1rem,3.8vw,1.35rem)] leading-relaxed text-[var(--chat-text-color,var(--text-primary))] outline-none sm:px-5"
        />
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-black/80 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <p className={cn("min-w-0 truncate font-sans text-[11px]", error ? "text-red-300" : "text-[var(--text-muted)]")}>{error ?? `${value.length.toLocaleString()} characters`}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label="Cancel edit" onClick={onCancel} className="focus-ring h-10 rounded-sm border border-white/15 px-4 font-sans text-xs font-semibold text-[var(--text-secondary)]">Discard</button>
            <button type="button" aria-label="Save edit" onClick={onSave} disabled={!value.trim() || value.trim() === originalValue || saving} className="focus-ring h-10 rounded-sm border border-brand-secondary/60 bg-brand-secondary/[0.1] px-5 font-sans text-xs font-semibold text-brand-secondary disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving..." : "Save"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function areMessageBubblePropsEqual(previous: MessageBubbleProps, next: MessageBubbleProps) {
  return (
    previous.id === next.id &&
    previous.role === next.role &&
    previous.content === next.content &&
    previous.characterName === next.characterName &&
    previous.characterAvatarUrl === next.characterAvatarUrl &&
    previous.personaName === next.personaName &&
    previous.personaAvatarUrl === next.personaAvatarUrl &&
    previous.isPinned === next.isPinned &&
    previous.inputTokens === next.inputTokens &&
    previous.outputTokens === next.outputTokens &&
    previous.estimatedCost === next.estimatedCost &&
    previous.usageEstimated === next.usageEstimated &&
    previous.isLatestAssistant === next.isLatestAssistant &&
    previous.variantIndex === next.variantIndex &&
    previous.variantCount === next.variantCount &&
    Boolean(previous.onRetry) === Boolean(next.onRetry) &&
    Boolean(previous.onRegenerate) === Boolean(next.onRegenerate) &&
    Boolean(previous.onContinue) === Boolean(next.onContinue) &&
    Boolean(previous.onRewind) === Boolean(next.onRewind)
  );
}

function formatEstimatedCost(value: number | string) {
  const cost = Number(value);
  if (!Number.isFinite(cost)) {
    return "Cost unavailable";
  }
  if (cost > 0 && cost < 0.0001) {
    return "<$0.0001";
  }
  return `$${cost.toFixed(4)}`;
}

function ActionButton({
  label,
  onClick,
  children,
  disabled,
  showLabel = false,
  className
}: {
  label: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.92 } : undefined}
      transition={springSnappy}
      className={cn(
        "focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-white/15 hover:bg-black/30 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35",
        className
      )}
    >
      {children}
      {showLabel ? <span>{label}</span> : null}
    </motion.button>
  );
}
