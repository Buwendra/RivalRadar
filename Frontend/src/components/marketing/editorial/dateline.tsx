import { cn } from "@/lib/utils";

/**
 * Dateline — the small mono label that opens every editorial section, like
 * the kicker on a briefing. Optional section index (01–07) sets up the
 * "report table of contents" reading. Tabular figures so indices align.
 */
export function Dateline({
  index,
  children,
  className,
}: {
  index?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 font-mono text-label uppercase text-muted-foreground",
        className,
      )}
    >
      {index && (
        <span className="nums-tabular text-foreground/70">{index}</span>
      )}
      <span aria-hidden className="h-px w-6 shrink-0 bg-foreground/30" />
      <span>{children}</span>
    </div>
  );
}
