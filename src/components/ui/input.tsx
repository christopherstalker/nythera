import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring glass-input flex h-12 w-full rounded-[var(--radius-md)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-55 focus:border-[var(--accent-purple)]",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
