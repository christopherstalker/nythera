import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-mono text-[11px] font-medium uppercase tracking-[.14em] no-underline transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100",
  {
    variants: {
      variant: {
        primary:
          "border-brand-secondary/55 bg-brand-secondary/[.08] text-brand-secondary hover:border-brand-secondary hover:bg-brand-secondary/[.13]",
        secondary:
          "border-outline bg-transparent text-content-primary hover:border-content-primary/45 hover:bg-content-primary/[.05]",
        ghost:
          "border-transparent bg-transparent text-content-muted hover:border-outline hover:text-content-primary",
        outline:
          "border-outline bg-transparent text-content-secondary hover:border-brand-secondary/45 hover:text-brand-secondary",
        destructive:
          "border-danger/60 bg-transparent text-danger hover:border-danger hover:bg-danger/10"
      },
      size: {
        sm: "h-11 px-3 text-[10px]",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-xs",
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
