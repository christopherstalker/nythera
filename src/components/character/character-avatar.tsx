import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type CharacterAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-28 w-28 text-4xl"
};

export function CharacterAvatar({ name, avatarUrl, size = "md", className }: CharacterAvatarProps) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-primary/[0.18] bg-primary/[0.075] text-primary shadow-inset",
        sizes[size],
        className
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : name ? (
        <span className="font-semibold">{name.slice(0, 1).toUpperCase()}</span>
      ) : (
        <Bot className="h-5 w-5" />
      )}
    </div>
  );
}
