import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring glass-input min-h-28 w-full resize-y rounded-[var(--radius-md)] px-4 py-3 text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-55 focus:border-[var(--accent-purple)]",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
