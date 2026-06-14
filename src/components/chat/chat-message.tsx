import { User } from "lucide-react";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { RichMessageText } from "@/components/chat/rich-message-text";
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
      {isUser ? (
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.045] text-foreground shadow-inset">
          <User className="h-4 w-4" />
        </div>
      ) : (
        <CharacterAvatar name={characterName} avatarUrl={avatarUrl} size="sm" className="h-10 w-10" />
      )}
      <div className={cn("flex max-w-[84%] flex-col sm:max-w-[70%]", isUser && "items-end")}>
        {isUser ? (
          <p className="mb-1 text-right text-xs font-medium text-muted-foreground">You</p>
        ) : (
          <p className="mb-1 text-xs font-medium text-primary">{characterName}</p>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-[24px] px-4 py-3 text-sm leading-7 shadow-inset",
            isUser
              ? "rounded-br-md border border-primary/[0.08] bg-primary/[0.105] text-foreground"
              : "rounded-bl-md border border-white/[0.025] bg-white/[0.04] text-foreground"
          )}
        >
          {content ? (
            <RichMessageText text={content} />
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
