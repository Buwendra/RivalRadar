import { cn } from "@/lib/utils";
import { Dateline } from "./dateline";
import { SectionMarker } from "./section-marker";

/**
 * EditorialSection — the section frame the whole marketing surface composes
 * from. A two-column editorial grid: a sticky left rail carrying the dateline
 * + section numeral (the "briefing" spine), and the content column on the
 * right. This is what keeps the site reading as one publication rather than a
 * stack of centered SaaS blocks.
 *
 * On mobile the rail collapses above the content (no wasted column). The rail
 * is sticky on large screens so the section's label stays with you as you read.
 */
export function EditorialSection({
  id,
  index,
  label,
  children,
  className,
  containerClassName,
  contentClassName,
}: {
  id?: string;
  /** Section numeral, e.g. "01". Drives both the dateline index and the marker. */
  index?: string;
  /** Dateline label, e.g. "The problem". */
  label?: string;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-24 md:py-32", className)}>
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-6 sm:px-8",
          containerClassName,
        )}
      >
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {(label || index) && (
            <div className="lg:sticky lg:top-28 lg:self-start">
              {label && <Dateline index={index}>{label}</Dateline>}
              {index && (
                <SectionMarker n={index} className="mt-6 hidden lg:block" />
              )}
            </div>
          )}
          <div className={cn("min-w-0", contentClassName)}>{children}</div>
        </div>
      </div>
    </section>
  );
}
