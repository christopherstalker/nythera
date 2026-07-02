"use client";

import { useEffect, useRef, useState } from "react";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { springSnappy, springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, GitFork, History, PenLine, Pin, RefreshCw, SendHorizontal, ShieldAlert, Trash2, Volume2 } from "lucide-react";

const LONG_PRESS_DELAY_MS = 500;
const DELETE_EXIT_DELAY_MS = 140;

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  personaName?: string | null;
  isPinned?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | string | null;
  usageEstimated?: boolean | null;
  onEdit?: (messageId: string, content: string) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onRegenerate?: (messageId: string) => void;
  onContinue?: () => void;
  onRewind?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  isLatestAssistant?: boolean;
  variantIndex?: number;
  variantCount?: number;
  onPreviousVariant?: () => void;
  onNextVariant?: () => void;
};

export function MessageBubble({
  id,
  role,
  content,
  characterName,
  personaName,
  isPinned,
  inputTokens,
  outputTokens,
  estimatedCost,
  usageEstimated,
  onEdit,
  onDelete,
  onRegenerate,
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
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUser = role === "USER";
  const hasVariants = !isUser && variantCount !== undefined && variantCount > 1 && variantIndex !== undefined;

  useEffect(() => {
    if (!menuPosition) return;
    const handleClose = () => setMenuPosition(null);
    const handleEsc = (event: KeyboardEvent) => event.key === "Escape" && handleClose();

    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, { passive: true });
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [menuPosition]);

  if (role === "SYSTEM") {
    return (
      <p className="px-4 py-2 text-center text-xs italic text-[var(--text-muted)]">
        {content}
      </p>
    );
  }

  function edit() {
    setEditDraft(content);
    setIsEditing(true);
    setMenuPosition(null);
  }

  async function saveEdit() {
    const next = editDraft.trim();
    if (!next || next === content || savingEdit) {
      return;
    }

    setSavingEdit(true);
    await onEdit?.(id, next);
    setSavingEdit(false);
    setIsEditing(false);
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
    setMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }

    touchTimerRef.current = setTimeout(() => {
      setMenuPosition({ x, y });
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

    setMenuPosition(null);
    setIsDeleting(true);
    window.setTimeout(() => {
      void onDelete?.(id);
    }, DELETE_EXIT_DELAY_MS);
  }

  return (
    <motion.div
      className={cn(
        "group/message relative flex w-full message-enter",
        isUser ? "justify-end" : "justify-start",
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
      <div className={cn("flex min-w-0 flex-col", isUser ? "items-end" : "w-full items-start")}>
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
            "relative overflow-hidden shadow-[var(--shadow-soft)]",
            isUser
              ? "max-w-[min(74%,480px)] rounded-[20px] px-4 py-3 text-sm font-medium leading-6 max-sm:max-w-[82%] max-sm:text-base sm:max-w-[min(38vw,360px)]"
              : "w-full rounded-[28px] px-6 py-6 text-[26px] font-bold leading-[1.55] text-[var(--text-primary)] max-sm:min-h-32 sm:px-5 sm:py-4 sm:text-[15px] sm:font-medium sm:leading-7 md:rounded-[20px]"
          )}
          style={
            isUser
              ? {
                  background: "color-mix(in oklch, var(--text-primary) 92%, transparent)",
                  color: "var(--bg-base)",
                  border: "1px solid color-mix(in oklch, var(--text-primary) 38%, transparent)"
                }
              : {
                  background: "color-mix(in oklch, var(--bg-base) 92%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--border-subtle) 86%, transparent)",
                  backdropFilter: "blur(16px) saturate(150%)",
                  WebkitBackdropFilter: "blur(16px) saturate(150%)"
                }
          }
          whileHover={{ y: -1 }}
          transition={springSnappy}
        >
          {isPinned && (
            <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] text-[var(--accent-purple)]">
              <Pin className="h-3.5 w-3.5" />
            </span>
          )}
          {isEditing ? (
            <div className="grid gap-3">
              <textarea
                autoFocus
                aria-label="Edit message text"
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsEditing(false);
                  } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    void saveEdit();
                  }
                }}
                className="focus-ring min-h-24 w-full resize-y rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-primary)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  aria-label="Cancel edit"
                  onClick={() => setIsEditing(false)}
                  className="focus-ring rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--color-overlay)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-label="Save edit"
                  onClick={() => void saveEdit()}
                  disabled={!editDraft.trim() || editDraft.trim() === content || savingEdit}
                  className="focus-ring rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "var(--gradient-aurora-primary)" }}
                >
                  {savingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : content ? (
            <RichMessageText text={content} />
          ) : (
            <TypingIndicator />
          )}
        </motion.div>

        {content && !isEditing ? (
          <div
            className={cn(
              "mt-3 flex flex-wrap items-center gap-2",
              isLatestAssistant ? "opacity-100" : "opacity-0 max-sm:hidden sm:translate-y-1 sm:group-hover/message:translate-y-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:translate-y-0 sm:group-focus-within/message:opacity-100",
              isUser ? "justify-end" : "justify-between"
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <ActionButton label="Edit" onClick={edit} mobileHidden>
                <PenLine className="h-4 w-4" />
              </ActionButton>
              {!isUser ? (
                <>
                  <ActionButton label="Regenerate" onClick={() => onRegenerate?.(id)} showLabel>
                    <RefreshCw className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton label="Continue" onClick={() => onContinue?.()} showLabel>
                    <SendHorizontal className="h-4 w-4" />
                  </ActionButton>
                </>
              ) : null}
              <ActionButton label="Rewind" onClick={() => onRewind?.(id)}>
                <History className="h-4 w-4" />
              </ActionButton>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {hasVariants && (
                <span className="flex h-10 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-2 text-sm font-bold text-[var(--text-primary)] shadow-[var(--glass-highlight)]">
                  <ActionButton
                    label="Previous attempt"
                    onClick={() => onPreviousVariant?.()}
                    disabled={variantIndex <= 0}
                    compact
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </ActionButton>
                  <span className="min-w-10 text-center">
                    {variantIndex! + 1}/{variantCount}
                  </span>
                  <ActionButton
                    label="Next attempt"
                    onClick={() => onNextVariant?.()}
                    disabled={variantIndex >= variantCount! - 1}
                    compact
                  >
                    <ChevronRight className="h-4 w-4" />
                  </ActionButton>
                </span>
              )}
              <ActionButton label="Branch" onClick={() => onBranch?.(id)} mobileHidden>
                <GitFork className="h-4 w-4" />
              </ActionButton>
              <ActionButton label="Report" onClick={report} mobileHidden>
                <ShieldAlert className="h-4 w-4" />
              </ActionButton>
              <ActionButton label="Delete" onClick={deleteWithMotion} disabled={isDeleting} destructive mobileHidden>
                <Trash2 className="h-4 w-4" />
              </ActionButton>
            </div>
          </div>
        ) : null}
      </div>

      <span className="sr-only">{isUser ? personaName || "You" : characterName}</span>

      {menuPosition && (
        <MessageContextMenu
          isOpen
          position={menuPosition}
          onClose={() => setMenuPosition(null)}
          onCopy={copyToClipboard}
          onEdit={edit}
          onRegenerate={!isUser ? () => onRegenerate?.(id) : undefined}
          onRewind={() => onRewind?.(id)}
          onPin={onPin ? () => onPin(id) : undefined}
          onDelete={deleteWithMotion}
          isUserMessage={isUser}
          isPinned={isPinned}
        />
      )}
    </motion.div>
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
  destructive = false,
  compact = false,
  showLabel = false,
  mobileHidden = false
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  compact?: boolean;
  showLabel?: boolean;
  mobileHidden?: boolean;
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
        "focus-ring inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-35",
        compact
          ? "h-6 w-6 border border-transparent bg-transparent"
          : showLabel
            ? "h-10 gap-2 border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-4 text-sm font-semibold shadow-[var(--glass-highlight)] hover:text-[var(--text-primary)]"
            : "h-10 w-10 border border-[var(--border-subtle)] bg-[var(--color-overlay)] shadow-[var(--glass-highlight)] hover:text-[var(--text-primary)]",
        mobileHidden && "max-sm:hidden",
        destructive && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 focus:ring-red-400/30"
      )}
    >
      {children}
      {showLabel ? <span>{label}</span> : null}
    </motion.button>
  );
}
