import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vedha-cyan/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "btn-gradient text-white shadow-glow hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-background text-foreground hover:bg-accent hover:border-vedha-teal/30 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-vedha-cyan/30 dark:hover:shadow-glow",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border dark:border-white/5",
        ghost:
          "hover:bg-accent hover:text-accent-foreground text-muted-foreground dark:hover:bg-white/[0.06] dark:hover:text-foreground",
        link: "text-vedha-teal underline-offset-4 hover:underline dark:text-vedha-cyan",
        glass:
          "glass text-foreground hover:border-vedha-teal/25 hover:shadow-glow dark:hover:border-vedha-cyan/25",
        gold:
          "bg-gradient-to-r from-vedha-gold to-vedha-champagne text-white font-semibold hover:shadow-glow-gold dark:text-[#09090B]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
