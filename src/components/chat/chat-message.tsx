import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessageProps = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  characterName: string;
  avatarUrl?: string | null;
};

export function ChatMessage({ role, content, characterName, avatarUrl }: ChatMessageProps) {
  if (role === "SYSTEM") {
    return <p className="text-center text-xs italic text-muted-foreground">{content}</p>;
  }

  const isUser = role === "USER";

  return (
    <div className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border",
          isUser ? "border-border bg-[#1a1a1a] text-foreground" : "border-primary bg-primary/10 text-primary"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn("max-w-[70%] sm:max-w-[68%]", isUser && "items-end")}>
        {!isUser ? (
          <p className="text-character mb-1 text-xs font-semibold uppercase text-primary">{characterName}</p>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
            isUser
              ? "rounded-br bg-[#1a1a1a] text-foreground"
              : "rounded-bl border border-border bg-card text-foreground"
          )}
        >
          {content ? (
            content
          ) : (
            <span className="flex items-center gap-1.5 py-1" aria-label={`${characterName} is typing`}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
