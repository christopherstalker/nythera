import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring min-h-28 w-full rounded-2xl border border-border bg-[hsl(var(--input))] px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground transition duration-200 focus:border-primary",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
