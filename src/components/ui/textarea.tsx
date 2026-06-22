import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring glass-input min-h-28 w-full resize-y rounded-control px-4 py-3 text-sm leading-6 text-content-primary placeholder:text-content-muted disabled:cursor-not-allowed disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100 focus:border-brand",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
