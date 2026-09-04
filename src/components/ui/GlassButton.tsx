"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "focus-ring relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-mono text-[11px] font-medium uppercase tracking-[.11em] no-underline transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-40 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        "glass-primary":
          "border-brand-secondary/55 bg-brand-secondary/[.08] px-5 py-2.5 text-brand-secondary hover:border-brand-secondary hover:bg-brand-secondary/[.13]",
        "glass-secondary":
          "border-outline bg-transparent px-5 py-2.5 text-content-secondary hover:border-content-primary/45 hover:bg-content-primary/[.05] hover:text-content-primary",
        "glass-icon":
          "h-10 w-10 rounded-full border-outline bg-transparent p-0 text-content-secondary hover:border-brand-secondary/45 hover:text-brand-secondary",
        "glass-fab":
          "h-14 w-14 rounded-full border-brand-secondary/55 bg-[var(--codex-paper-raised)] p-0 text-brand-secondary hover:border-brand-secondary",
        "glass-patreon":
          "border-[#ff424d]/55 bg-transparent px-5 py-2.5 text-[#ff9da3] hover:border-[#ff7a82] hover:bg-[#ff424d]/[.06]"
      },
      size: {
        sm: "h-9 min-w-9 px-3 text-xs",
        md: "h-11 min-w-11 px-4 text-sm",
        lg: "h-12 min-w-12 px-6 text-sm",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: {
      variant: "glass-primary",
      size: "md"
    }
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

GlassButton.displayName = "GlassButton";
