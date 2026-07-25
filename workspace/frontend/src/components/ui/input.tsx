import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground shadow-sm transition-all duration-300",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground/70",
          "focus-visible:outline-none focus-visible:border-vedha-teal/40 focus-visible:ring-2 focus-visible:ring-vedha-teal/20",
          "dark:border-white/10 dark:bg-white/[0.04] dark:focus-visible:border-vedha-cyan/40 dark:focus-visible:ring-vedha-cyan/20 dark:focus-visible:bg-white/[0.06]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
