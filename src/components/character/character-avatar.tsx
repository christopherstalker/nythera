import { Avatar } from "@/components/ui/avatar";
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
  return <Avatar name={name} src={avatarUrl} className={cn("border border-[var(--border-default)] bg-[var(--bg-elevated)]", sizes[size], className)} />;
}
