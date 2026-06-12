import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring flex h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-2 text-sm text-foreground shadow-inset placeholder:text-muted-foreground transition duration-200 focus:border-primary/40 focus:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
