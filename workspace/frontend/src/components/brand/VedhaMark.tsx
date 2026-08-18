import { cn } from "@/lib/utils";

/** Official Vedha “V” mark from vedha.ae — lime on black. */
export function VedhaMark({
  className,
  alt = "Vedha",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/favicon.svg"
        alt={alt}
        className="h-[78%] w-[78%] object-contain"
      />
    </span>
  );
}
