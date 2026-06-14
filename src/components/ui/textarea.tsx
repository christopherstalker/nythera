import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-200 focus:border-[var(--accent-purple)] focus:ring-1 focus:ring-[var(--accent-purple)] disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
