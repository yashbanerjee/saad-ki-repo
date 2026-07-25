import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-xl bg-white/[0.04]", className)}
      {...props}
    />
  );
}

export { Skeleton };
