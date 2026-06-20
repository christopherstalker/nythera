"use client";

import { useState, useEffect, useRef } from "react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsRight, GitBranch, History, Pencil, RefreshCcw, Trash2, Flag, User } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  characterAvatarUrl?: string | null;
  isPinned?: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
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
  isPinned,
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
    const next = window.prompt("Edit message", content);
    if (next !== null && next.trim() && next !== content) {
      onEdit?.(id, next);
    }
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

  return (
    <div
      className={cn("group flex message-enter relative w-full", isUser ? "justify-end" : "justify-start")}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div className={cn("flex max-w-[92%] items-start gap-2 sm:max-w-[85%] xl:max-w-[75%]", isUser && "flex-row-reverse")}>
        {isUser ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] xl:hidden">
            <User className="h-4 w-4" />
          </span>
        ) : (
          <CharacterAvatar name={characterName} avatarUrl={characterAvatarUrl} size="sm" className="h-9 w-9 shrink-0 rounded-full xl:hidden" />
        )}
        <div className={cn("flex flex-col", isUser ? "items-end" : "items-start", "w-full max-w-full")}>
          <div
            className={cn(
              "bubble-char relative w-full max-w-full",
              isUser && "bubble-user"
            )}
          >
            {isPinned && (
              <span className="absolute -top-2 -right-2 text-[var(--accent-purple)] text-xs">
                📌
              </span>
            )}
            {content ? <RichMessageText text={content} /> : <TypingIndicator />}
          </div>

          {content ? (
            <div
              className={cn(
                "mt-1 flex flex-wrap gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              {isUser ? (
                <ActionButton label="Edit" onClick={edit}>
                  <Pencil className="h-3.5 w-3.5" />
                </ActionButton>
              ) : (
                <>
                  <ActionButton label="Continue" onClick={() => onContinue?.()}>
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton label="Regenerate" onClick={() => onRegenerate?.(id)}>
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </ActionButton>
                </>
              )}
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
                <GitBranch className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton label="Report" onClick={report}>
                <Flag className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton label="Delete" onClick={() => onDelete?.(id)} destructive>
                <Trash2 className="h-3.5 w-3.5" />
              </ActionButton>
            </div>
          ) : null}
        </div>
      </div>

      <span className="sr-only">{isUser ? "You" : characterName}</span>

      {menuPosition && (
        <MessageContextMenu
          isOpen
          position={menuPosition}
          onClose={() => setMenuPosition(null)}
          onCopy={copyToClipboard}
          onEdit={isUser ? edit : undefined}
          onRegenerate={!isUser ? () => onRegenerate?.(id) : undefined}
          onRewind={() => onRewind?.(id)}
          onPin={onPin ? () => onPin(id) : undefined}
          onDelete={() => onDelete?.(id)}
          isUserMessage={isUser}
          isPinned={isPinned}
        />
      )}
    </div>
  );
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
          : "h-9 w-9 border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--glass-highlight)] backdrop-blur-xl",
        destructive && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 focus:ring-red-400/30"
      )}
    >
      {children}
    </button>
  );
}
