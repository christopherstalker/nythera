import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "primary-gradient text-primary-foreground shadow-violet-hover hover:-translate-y-0.5 hover:shadow-violet-strong",
        secondary: "bg-primary/[0.105] text-foreground shadow-inset hover:-translate-y-0.5 hover:bg-primary/[0.15]",
        ghost: "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
        outline: "bg-primary/[0.105] text-foreground shadow-inset hover:-translate-y-0.5 hover:bg-primary/[0.15]",
        destructive: "bg-destructive/90 text-destructive-foreground hover:bg-destructive"
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 px-0"
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
