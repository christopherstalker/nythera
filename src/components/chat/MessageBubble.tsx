import { RichMessageText } from "@/components/chat/rich-message-text";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { cn } from "@/lib/utils";
import { Flag, GitBranch, Pencil, RefreshCcw, Trash2 } from "lucide-react";

type MessageBubbleProps = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
};

export function MessageBubble({ id, role, content, characterName, onEdit, onDelete, onRegenerate, onBranch }: MessageBubbleProps) {
  if (role === "SYSTEM") {
    return <p className="text-center text-xs italic text-[var(--text-muted)]">{content}</p>;
  }

  const isUser = role === "USER";

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
      <div className={cn("max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div className={cn("whitespace-pre-wrap break-words", isUser ? "bubble-user max-w-full" : "bubble-char max-w-full")}>
          {content ? <RichMessageText text={content} /> : <TypingIndicator />}
        </div>
        {content ? (
          <div className={cn("mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100", isUser ? "justify-end" : "justify-start")}>
            {isUser ? (
              <ActionButton label="Edit" onClick={edit}>
                <Pencil className="h-3.5 w-3.5" />
              </ActionButton>
            ) : (
              <ActionButton label="Regenerate" onClick={() => onRegenerate?.(id)}>
                <RefreshCcw className="h-3.5 w-3.5" />
              </ActionButton>
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
      <span className="sr-only">{isUser ? "You" : characterName}</span>
    </div>
  );
}

function ActionButton({
  label,
  children,
  destructive,
  onClick
}: {
  label: string;
  children: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "focus-ring grid h-7 w-7 place-items-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
        destructive && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
      )}
    >
      {children}
    </button>
  );
}
