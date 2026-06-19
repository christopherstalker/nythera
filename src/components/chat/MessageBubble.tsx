import { useState, useEffect, useRef } from "react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsRight, Flag, GitBranch, Pencil, RefreshCcw, Trash2, Copy, History } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onContinue?: () => void;
  onRewind?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
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
  onEdit,
  onDelete,
  onRegenerate,
  onContinue,
  onRewind,
  onBranch,
  variantIndex,
  variantCount,
  onPreviousVariant,
  onNextVariant
}: MessageBubbleProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!menuPosition) return;
    const handleClose = () => setMenuPosition(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, { passive: true });
    window.addEventListener("contextmenu", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose);
      window.removeEventListener("contextmenu", handleClose);
    };
  }, [menuPosition]);

  if (role === "SYSTEM") {
    return <p className="text-center text-xs italic text-[var(--text-muted)]">{content}</p>;
  }

  const isUser = role === "USER";
  const hasVariants = !isUser && variantCount !== undefined && variantCount > 1 && variantIndex !== undefined;

  function edit() {
    const next = window.prompt("Edit message", content);
    if (next !== null && next.trim() && next !== content) {
      onEdit?.(id, next);
    }
  }

  async function report() {
    const details = window.prompt("Report details", "Problematic message");
    if (details === null) {
      return;
    }

    const response = await fetch(`/api/messages/${id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Message report", details })
    });

    if (!response.ok) {
      window.alert("Could not submit report.");
      return;
    }

    window.alert("Report submitted.");
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
    }, 600);
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
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const getMenuCoords = () => {
    if (!menuPosition) return { top: 0, left: 0 };
    const menuWidth = 160;
    const menuHeight = 240;
    
    let left = menuPosition.x;
    let top = menuPosition.y;

    if (typeof window !== "undefined") {
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 12;
      }
      if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 12;
      }
    }

    return { top, left };
  };

  const coords = getMenuCoords();

  return (
    <div
      className={cn("group flex message-enter relative", isUser ? "justify-end" : "justify-start")}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div className={cn("max-w-[92%] sm:max-w-[78%]", isUser ? "items-end" : "items-start")}>
        <div className={cn("whitespace-pre-wrap break-words select-text", isUser ? "bubble-user max-w-full" : "bubble-char max-w-full")}>
          {content ? <RichMessageText text={content} /> : <TypingIndicator />}
        </div>
        {content ? (
          <div className={cn("mt-1 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100", isUser ? "justify-end" : "justify-start")}>
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
            {hasVariants ? (
              <span className="flex h-8 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 text-xs text-[var(--text-secondary)] shadow-[var(--glass-highlight)] backdrop-blur-xl">
                <ActionButton label="Previous attempt" onClick={() => onPreviousVariant?.()} disabled={variantIndex <= 0} compact>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </ActionButton>
                <span className="min-w-9 text-center">{variantIndex + 1}/{variantCount}</span>
                <ActionButton label="Next attempt" onClick={() => onNextVariant?.()} disabled={variantIndex >= variantCount - 1} compact>
                  <ChevronRight className="h-3.5 w-3.5" />
                </ActionButton>
              </span>
            ) : null}
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
      <span className="sr-only">{isUser ? "You" : characterName}</span>

      {menuPosition && (
        <div
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
          className="z-[9999] flex w-[160px] flex-col gap-0.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-2xl backdrop-blur-xl animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              void copyToClipboard();
              setMenuPosition(null);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-white/[0.055] transition-colors"
          >
            <Copy className="h-4 w-4 text-[var(--text-secondary)]" />
            Copy
          </button>

          {isUser && (
            <button
              type="button"
              onClick={() => {
                edit();
                setMenuPosition(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-white/[0.055] transition-colors"
            >
              <Pencil className="h-4 w-4 text-[var(--text-secondary)]" />
              Edit
            </button>
          )}

          {!isUser && (
            <button
              type="button"
              onClick={() => {
                onContinue?.();
                setMenuPosition(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-white/[0.055] transition-colors"
            >
              <ChevronsRight className="h-4 w-4 text-[var(--text-secondary)]" />
              Continue
            </button>
          )}

          {!isUser && (
            <button
              type="button"
              onClick={() => {
                onRegenerate?.(id);
                setMenuPosition(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-white/[0.055] transition-colors"
            >
              <RefreshCcw className="h-4 w-4 text-[var(--text-secondary)]" />
              Regenerate
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onRewind?.(id);
              setMenuPosition(null);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-white/[0.055] transition-colors"
          >
            <History className="h-4 w-4 text-[var(--text-secondary)]" />
            Rewind
          </button>

          <button
            type="button"
            onClick={() => {
              onBranch?.(id);
              setMenuPosition(null);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-white/[0.055] transition-colors"
          >
            <GitBranch className="h-4 w-4 text-[var(--text-secondary)]" />
            Branch
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete?.(id);
              setMenuPosition(null);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 hover:text-red-200 transition-colors"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
            Delete
          </button>
        </div>
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
  compact
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
        "focus-ring grid place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35",
        compact ? "h-5 w-5 border-0 bg-transparent" : "h-8 w-8 border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--glass-highlight)] backdrop-blur-xl",
        destructive && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
      )}
    >
      {children}
    </button>
  );
}
