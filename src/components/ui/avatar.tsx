import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type AvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imageClassName?: string;
};

const sizes = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl"
};

export function Avatar({ name, src, size = "md", className, imageClassName }: AvatarProps) {
  const initial = name?.trim()?.slice(0, 1)?.toUpperCase();

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-elevated)] text-[var(--accent-purple)]",
        sizes[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt="" className={cn("h-full w-full object-cover", imageClassName)} />
      ) : initial ? (
        <span className="font-semibold">{initial}</span>
      ) : (
        <Bot className="h-5 w-5" />
      )}
    </span>
  );
}
