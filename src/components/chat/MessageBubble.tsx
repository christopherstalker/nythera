"use client";

import { useState, useEffect, useRef } from "react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, GitFork, History, PenLine, Pin, RefreshCw, SendHorizontal, ShieldAlert, Trash2, User } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  characterAvatarUrl?: string | null;
  personaName?: string | null;
  personaAvatarUrl?: string | null;
  isPinned?: boolean;
  model?: string | null;
  provider?: string | null;
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
  characterAvatarUrl,
  personaName,
  personaAvatarUrl,
  isPinned,
  model,
  provider,
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
  variantIndex,
  variantCount,
  onPreviousVariant,
  onNextVariant,
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
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
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
      <p className="text-center text-xs italic text-[var(--text-muted)] px-4 py-2">
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
        body: JSON.stringify({ reason: "Message report", details }),
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }

    touchTimerRef.current = setTimeout(() => {
      setMenuPosition({ x, y });
    }, 500);
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
    }, 140);
  }

  return (
    <div
      className={cn(
        "group flex message-enter relative w-full",
        isUser ? "justify-end" : "justify-start",
        isDeleting && "message-exit pointer-events-none"
      )}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div className={cn("flex max-w-[100%] items-start gap-2.5 sm:max-w-[92%] sm:gap-3 xl:max-w-[86%]", isUser && "flex-row-reverse")}>
        {isUser ? (
          personaAvatarUrl || personaName ? (
            <Avatar
              name={personaName ?? "You"}
              src={personaAvatarUrl}
              size="sm"
              className="h-9 w-9 shrink-0 border-0 bg-[var(--bg-elevated)] shadow-[0_0_28px_oklch(var(--color-accent-secondary)/.14)]"
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
              <User className="h-4 w-4" />
            </span>
          )
        ) : (
          <CharacterAvatar name={characterName} avatarUrl={characterAvatarUrl} size="sm" className="mt-1 hidden h-10 w-10 shrink-0 rounded-[14px] shadow-[var(--shadow-soft)] sm:inline-grid" />
        )}
        <div className={cn("flex flex-col", isUser ? "items-end" : "items-start", "w-full max-w-full")}>
          {!isUser ? <p className="mb-1.5 hidden px-1 text-[11px] font-semibold tracking-wide text-[var(--accent-secondary)] sm:block">{characterName}</p> : null}
          <div
            className={cn(
              "bubble-char relative w-full max-w-full",
              isUser && "bubble-user"
            )}
          >
            {isPinned && (
              <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-[color:oklch(var(--color-accent-primary)/.35)] bg-[var(--bg-elevated)] text-[0px] text-[var(--accent-purple)] shadow-[var(--shadow-glow-soft)]">
                <Pin className="h-3 w-3" />
              </span>
            )}
            {isEditing ? (
              <div className="grid gap-2">
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
                  className="focus-ring min-h-24 w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm leading-6 text-[var(--text-primary)]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label="Cancel edit"
                    onClick={() => setIsEditing(false)}
                    className="focus-ring rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    aria-label="Save edit"
                    onClick={() => void saveEdit()}
                    disabled={!editDraft.trim() || editDraft.trim() === content || savingEdit}
                    className="focus-ring rounded-full bg-[var(--accent-purple)] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>

          {!isUser && content && (inputTokens !== null && inputTokens !== undefined || outputTokens !== null && outputTokens !== undefined) ? (
            <p
              className="mt-1 px-1 text-[10px] text-[var(--text-muted)]"
              title={estimatedCost !== null && estimatedCost !== undefined ? "Estimated cost in USD based on public provider pricing" : "Token usage"}
            >
              {provider ? `${provider}${model ? ` · ${model}` : ""} · ` : ""}
              {usageEstimated ? "~" : ""}{inputTokens ?? 0} in / {outputTokens ?? 0} out
              {estimatedCost !== null && estimatedCost !== undefined ? ` · ${formatEstimatedCost(estimatedCost)}` : ""}
            </p>
          ) : null}

          {content && !isEditing ? (
            <div
              className={cn(
                "mt-1 flex flex-wrap gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              <ActionButton label="Edit" onClick={edit}>
                <PenLine className="h-3.5 w-3.5" />
              </ActionButton>
              {!isUser ? (
                <>
                  <ActionButton label="Continue" onClick={() => onContinue?.()}>
                    <SendHorizontal className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton label="Regenerate" onClick={() => onRegenerate?.(id)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </ActionButton>
                </>
              ) : null}
              <ActionButton label="Rewind" onClick={() => onRewind?.(id)}>
                <History className="h-3.5 w-3.5" />
              </ActionButton>
              {hasVariants && (
                <span className="flex h-8 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 text-xs text-[var(--text-secondary)] shadow-[var(--glass-highlight)] backdrop-blur-xl">
                  <ActionButton
                    label="Previous attempt"
                    onClick={() => onPreviousVariant?.()}
                    disabled={variantIndex <= 0}
                    compact
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </ActionButton>
                  <span className="min-w-9 text-center">
                    {variantIndex! + 1}/{variantCount}
                  </span>
                  <ActionButton
                    label="Next attempt"
                    onClick={() => onNextVariant?.()}
                    disabled={variantIndex >= variantCount! - 1}
                    compact
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </ActionButton>
                </span>
              )}
              <ActionButton label="Branch" onClick={() => onBranch?.(id)}>
                <GitFork className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton label="Report" onClick={report}>
                <ShieldAlert className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton label="Delete" onClick={deleteWithMotion} disabled={isDeleting} destructive>
                <Trash2 className="h-3.5 w-3.5" />
              </ActionButton>
            </div>
          ) : null}
        </div>
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
    </div>
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
  children,
  destructive,
  onClick,
  disabled,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "focus-ring grid place-items-center rounded-full text-[var(--text-secondary)] transition-all duration-150 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35",
        compact
          ? "h-5 w-5 border-0 bg-transparent"
          : "h-8 w-8 border border-white/[0.08] bg-[color:oklch(var(--color-surface)/.58)] shadow-[var(--glass-highlight)] backdrop-blur-xl hover:border-[color:oklch(var(--color-accent-secondary)/.32)]",
        destructive && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 focus:ring-red-400/30"
      )}
    >
      {children}
    </button>
  );
}
