import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring min-h-28 w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-foreground shadow-inset placeholder:text-muted-foreground transition duration-200 focus:border-primary/40 focus:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
