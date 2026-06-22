import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold no-underline transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:border-outline-disabled disabled:text-content-disabled disabled:opacity-100",
  {
    variants: {
      variant: {
        primary:
          "border border-outline-subtle bg-aurora-primary text-primary-foreground shadow-glow hover:-translate-y-0.5 hover:shadow-glow",
        secondary:
          "border border-outline bg-elevated text-content-primary shadow-raised backdrop-blur-xl hover:-translate-y-0.5 hover:border-outline-strong",
        ghost:
          "text-content-secondary hover:bg-surface/56 hover:text-content-primary",
        outline:
          "border border-outline bg-surface text-content-primary shadow-raised backdrop-blur-xl hover:-translate-y-0.5 hover:border-outline-strong",
        destructive:
          "border border-danger/30 bg-danger/15 text-destructive-foreground hover:-translate-y-0.5 hover:bg-danger/25"
      },
      size: {
        sm: "h-11 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-12 px-8 text-base",
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
