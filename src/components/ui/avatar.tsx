import Image from "next/image";
import { Bot } from "lucide-react";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
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

const imageSizes = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 96
};

export function Avatar({ name, src, size = "md", className, imageClassName }: AvatarProps) {
  const initial = name?.trim()?.slice(0, 1)?.toUpperCase();

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-elevated)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)]",
        sizes[size],
        className
      )}
    >
      {src && shouldBypassNextImageOptimization(src) ? (
        <img src={src} alt="" className={cn("h-full w-full object-cover", imageClassName)} />
      ) : src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${imageSizes[size]}px`}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : initial ? (
        <span className="font-semibold">{initial}</span>
      ) : (
        <Bot className="h-5 w-5" />
      )}
    </span>
  );
}
