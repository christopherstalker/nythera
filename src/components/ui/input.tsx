import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring flex h-11 w-full rounded-2xl border border-border bg-[hsl(var(--input))] px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition duration-200 focus:border-primary",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
