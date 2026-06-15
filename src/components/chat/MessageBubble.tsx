import { RichMessageText } from "@/components/chat/rich-message-text";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Flag, GitBranch, ImageIcon, Pencil, RefreshCcw, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
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
  onBranch,
  variantIndex,
  variantCount,
  onPreviousVariant,
  onNextVariant
}: MessageBubbleProps) {
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

  return (
    <div className={cn("group flex animate-in fade-in slide-in-from-bottom-2 duration-200", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(isUser ? "max-w-[min(78vw,620px)] items-end" : "max-w-[min(92vw,720px)] items-start")}>
        <div className={cn("whitespace-pre-wrap break-words", isUser ? "bubble-user max-w-full" : "bubble-char max-w-full")}>
          {content ? <RichMessageText text={content} /> : <TypingIndicator />}
        </div>
        {content ? (
          <div className={cn("mt-3 flex flex-wrap gap-3 text-white transition-opacity", isUser ? "justify-end opacity-70 group-hover:opacity-100 focus-within:opacity-100" : "justify-start opacity-100")}>
            {isUser ? (
              <ActionButton label="Edit" onClick={edit}>
                <Pencil className="h-5 w-5" />
              </ActionButton>
            ) : (
              <ActionButton label="Regenerate" onClick={() => onRegenerate?.(id)}>
                <RefreshCcw className="h-6 w-6" />
              </ActionButton>
            )}
            {hasVariants ? (
              <span className="flex h-8 items-center gap-1 rounded-full bg-black/18 px-1 text-xs font-black text-white/80 backdrop-blur-md">
                <ActionButton label="Previous attempt" onClick={() => onPreviousVariant?.()} disabled={variantIndex <= 0} compact>
                  <ChevronLeft className="h-4 w-4" />
                </ActionButton>
                <span className="min-w-9 text-center">{variantIndex + 1}/{variantCount}</span>
                <ActionButton label="Next attempt" onClick={() => onNextVariant?.()} disabled={variantIndex >= variantCount - 1} compact>
                  <ChevronRight className="h-4 w-4" />
                </ActionButton>
              </span>
            ) : null}
            {!isUser ? (
              <>
                <ActionButton label="Continue faster" onClick={() => onRegenerate?.(id)}>
                  <ChevronRight className="h-6 w-6" />
                </ActionButton>
                <ActionButton label="Image" onClick={() => onBranch?.(id)}>
                  <ImageIcon className="h-6 w-6" />
                </ActionButton>
                <ActionButton label="Like" onClick={() => undefined}>
                  <ThumbsUp className="h-6 w-6" />
                </ActionButton>
                <ActionButton label="Dislike" onClick={() => undefined}>
                  <ThumbsDown className="h-6 w-6" />
                </ActionButton>
              </>
            ) : null}
            {isUser ? (
              <>
                <ActionButton label="Branch" onClick={() => onBranch?.(id)}>
                  <GitBranch className="h-5 w-5" />
                </ActionButton>
                <ActionButton label="Report" onClick={report}>
                  <Flag className="h-5 w-5" />
                </ActionButton>
                <ActionButton label="Delete" onClick={() => onDelete?.(id)} destructive>
                  <Trash2 className="h-5 w-5" />
                </ActionButton>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className="sr-only">{isUser ? "You" : characterName}</span>
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
        "focus-ring grid place-items-center rounded-full text-white drop-shadow transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35",
        compact ? "h-6 w-6" : "h-8 w-8",
        destructive && "hover:bg-red-500/18 hover:text-red-200"
      )}
    >
      {children}
    </button>
  );
}
