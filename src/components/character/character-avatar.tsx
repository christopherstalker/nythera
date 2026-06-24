import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CharacterAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  sm: { box: "h-10 w-10", text: "text-sm" },
  md: { box: "h-12 w-12", text: "text-base" },
  lg: { box: "h-16 w-16", text: "text-xl" },
  xl: { box: "h-28 w-28", text: "text-4xl" }
};

export function CharacterAvatar({ name, avatarUrl, size = "md", className }: CharacterAvatarProps) {
  const s = sizes[size];

  return (
    <span className={cn("inline-grid rounded-full p-[2px]", s.box, className, "bg-gradient-to-br from-[#8F81F7] to-[#3EA8FF] shadow-[0_10px_30px_rgba(143,129,247,0.12)]")}> 
      <Avatar
        name={name}
        src={avatarUrl}
        className={cn("h-full w-full rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]", s.text)}
      />
    </span>
  );
}
