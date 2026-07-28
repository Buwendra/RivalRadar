import { cn } from "@/lib/utils";

/**
 * PullQuote — a display-weight statement lifted out of the running text, set
 * against a hanging hairline rule (not a giant quotation glyph). Used sparingly
 * to give a page one moment of editorial voice.
 */
export function PullQuote({
  children,
  cite,
  className,
}: {
  children: React.ReactNode;
  cite?: string;
  className?: string;
}) {
  return (
    <figure className={cn("border-l border-foreground/25 pl-6 md:pl-8", className)}>
      <blockquote className="font-display text-display-m text-foreground">
        {children}
      </blockquote>
      {cite && (
        <figcaption className="mt-5 font-mono text-label uppercase text-muted-foreground">
          {cite}
        </figcaption>
      )}
    </figure>
  );
}
