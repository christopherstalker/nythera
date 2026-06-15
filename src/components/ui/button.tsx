import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] text-sm font-semibold no-underline transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "border border-white/10 bg-gradient-to-br from-[var(--brand-secondary)] via-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[0_18px_42px_rgb(0_0_0_/_0.24)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]",
        secondary:
          "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[var(--glass-highlight)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-[rgb(var(--accent-rgb)_/_0.24)] hover:bg-white/[0.07]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]",
        outline:
          "border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] shadow-[var(--glass-highlight)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-[rgb(var(--accent-rgb)_/_0.22)] hover:bg-white/[0.055]",
        destructive:
          "border border-red-300/20 bg-red-500/15 text-red-100 hover:-translate-y-0.5 hover:bg-red-500/24"
      },
      size: {
        sm: "h-9 px-3.5 text-xs",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11 px-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";
