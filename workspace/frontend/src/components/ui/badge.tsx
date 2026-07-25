import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-vedha-teal/80 to-vedha-mid/80 text-white shadow-sm",
        secondary:
          "border-border bg-muted text-foreground dark:border-white/10 dark:bg-white/[0.06]",
        destructive:
          "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20 dark:text-red-300 dark:border-red-500/20",
        outline: "border-border text-foreground bg-transparent dark:border-white/15",
        success:
          "border-vedha-teal/30 bg-vedha-teal/15 text-vedha-teal dark:text-vedha-cyan",
        warning:
          "border-vedha-gold/30 bg-vedha-gold/15 text-vedha-gold dark:text-vedha-champagne",
        info:
          "border-vedha-teal/30 bg-vedha-teal/10 text-vedha-teal dark:border-vedha-cyan/30 dark:bg-vedha-cyan/10 dark:text-vedha-cyan",
        gold:
          "border-vedha-gold/40 bg-vedha-gold/20 text-vedha-gold dark:text-vedha-champagne",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
