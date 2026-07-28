import { cn } from "@/lib/utils";

/**
 * SectionMarker — an oversized, low-contrast display numeral that sits in the
 * section's left rail. Decorative (aria-hidden); it's the visual spine of the
 * "briefing" structure without competing with the headline for contrast.
 */
export function SectionMarker({
  n,
  className,
}: {
  n: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block font-display nums-tabular leading-none text-foreground/[0.09]",
        "text-[clamp(3.5rem,5vw,5.5rem)]",
        className,
      )}
    >
      {n}
    </span>
  );
}
