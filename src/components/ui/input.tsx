import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring glass-input flex h-12 w-full rounded-control px-4 py-2 text-sm text-content-primary placeholder:text-content-muted disabled:cursor-not-allowed disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100 focus:border-brand",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
