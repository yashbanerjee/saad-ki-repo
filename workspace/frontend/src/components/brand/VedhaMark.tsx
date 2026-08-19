import { cn } from "@/lib/utils";

/** Official Vedha “V” mark — lime, no plate behind it. */
export function VedhaMark({
  className,
  alt = "Vedha",
  src,
}: {
  className?: string;
  alt?: string;
  src?: string | null;
}) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || "/favicon.svg"}
        alt={alt}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
